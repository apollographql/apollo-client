import { DocumentNode, GraphQLError } from 'graphql';
import { equal } from "@wry/equality";

import { Cache, ApolloCache } from '../cache';
import { WatchQueryOptions } from './watchQueryOptions';
import { ObservableQuery } from './ObservableQuery';
import { QueryListener } from './types';
import { FetchResult } from '../link/core';
import {
  ObservableSubscription,
  isNonEmptyArray,
  graphQLResultHasError,
} from '../utilities';
import {
  NetworkStatus,
  isNetworkRequestInFlight,
} from './networkStatus';
import { ApolloError } from '../errors';

export type QueryStoreValue = Pick<QueryInfo,
  | "variables"
  | "networkStatus"
  | "networkError"
  | "graphQLErrors"
  >;

// A QueryInfo object represents a single query managed by the
// QueryManager, which tracks all QueryInfo objects by queryId in its
// this.queries Map. QueryInfo objects store the latest results and errors
// for the given query, and are responsible for reporting those results to
// the corresponding ObservableQuery, via the QueryInfo.notify method.
// Results are reported asynchronously whenever setDiff marks the
// QueryInfo object as dirty, though a call to the QueryManager's
// broadcastQueries method may trigger the notification before it happens
// automatically. This class used to be a simple interface type without
// any field privacy or meaningful methods, which is why it still has so
// many public fields. The effort to lock down and simplify the QueryInfo
// interface is ongoing, and further improvements are welcome.
export class QueryInfo {
  listeners = new Set<QueryListener>();
  document: DocumentNode | null = null;
  lastRequestId = 1;
  subscriptions = new Set<ObservableSubscription>();
  variables?: Record<string, any>;
  networkStatus?: NetworkStatus;
  networkError?: Error | null;
  graphQLErrors?: ReadonlyArray<GraphQLError>;

  constructor(private cache: ApolloCache<any>) {}

  public init(query: {
    document: DocumentNode;
    variables: Record<string, any> | undefined,
    // The initial networkStatus for this fetch, most often
    // NetworkStatus.loading, but also possibly fetchMore, poll, refetch,
    // or setVariables.
    networkStatus?: NetworkStatus,
    observableQuery?: ObservableQuery<any>;
    lastRequestId?: number;
  }): this {
    let networkStatus = query.networkStatus || NetworkStatus.loading;
    if (this.variables &&
        this.networkStatus !== NetworkStatus.loading &&
        !equal(this.variables, query.variables)) {
      networkStatus = NetworkStatus.setVariables;
    }

    if (!equal(query.variables, this.variables)) {
      this.diff = null;
    }

    Object.assign(this, {
      document: query.document,
      variables: query.variables,
      networkError: null,
      graphQLErrors: this.graphQLErrors || [],
      networkStatus,
    });

    if (query.observableQuery) {
      this.setObservableQuery(query.observableQuery);
    }

    if (query.lastRequestId) {
      this.lastRequestId = query.lastRequestId;
    }

    return this;
  }

  private dirty: boolean = false;

  private notifyTimeout?: ReturnType<typeof setTimeout>;

  private diff: Cache.DiffResult<any> | null = null;

  getDiff(variables = this.variables): Cache.DiffResult<any> {
    if (this.diff && equal(variables, this.variables)) {
      return this.diff;
    }

    this.updateWatch(this.variables = variables);

    return this.diff = this.cache.diff({
      query: this.document!,
      variables,
      returnPartialData: true,
      optimistic: true,
    });
  }

  setDiff(diff: Cache.DiffResult<any> | null) {
    const oldDiff = this.diff;
    this.diff = diff;
    if (!this.dirty && diff?.result !== oldDiff?.result) {
      this.dirty = true;
      if (!this.notifyTimeout) {
        this.notifyTimeout = setTimeout(() => this.notify(), 0);
      }
    }
  }

  public readonly observableQuery: ObservableQuery<any> | null = null;
  private oqListener?: QueryListener;

  setObservableQuery(oq: ObservableQuery<any> | null) {
    if (oq === this.observableQuery) return;

    if (this.oqListener) {
      this.listeners.delete(this.oqListener);
    }

    (this as any).observableQuery = oq;

    if (oq) {
      oq["queryInfo"] = this;
      this.listeners.add(this.oqListener = () => oq.reobserve());
    } else {
      delete this.oqListener;
    }
  }

  notify() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = void 0;
    }

    if (this.shouldNotify()) {
      this.listeners.forEach(listener => listener(this));
    }

    this.dirty = false;
  }

  private shouldNotify() {
    if (!this.dirty || !this.listeners.size) {
      return false;
    }

    if (isNetworkRequestInFlight(this.networkStatus) &&
        this.observableQuery) {
      const { fetchPolicy } = this.observableQuery.options;
      if (fetchPolicy !== "cache-only" &&
          fetchPolicy !== "cache-and-network") {
        return false;
      }
    }

    return true;
  }

  public stop() {
    this.cancel();
    // Revert back to the no-op version of cancel inherited from
    // QueryInfo.prototype.
    delete this.cancel;

    const oq = this.observableQuery;
    if (oq) oq.stopPolling();
  }

  // This method is a no-op by default, until/unless overridden by the
  // updateWatch method.
  private cancel() {}

  private lastWatch?: Cache.WatchOptions;

  private updateWatch(variables = this.variables) {
    const oq = this.observableQuery;
    if (oq && oq.options.fetchPolicy === "no-cache") {
      return;
    }
    if (!this.lastWatch ||
        this.lastWatch.query !== this.document ||
        !equal(variables, this.lastWatch.variables)) {
      this.cancel();
      this.cancel = this.cache.watch(this.lastWatch = {
        query: this.document!,
        variables,
        optimistic: true,
        callback: diff => this.setDiff(diff),
      });
    }
  }

  private lastWrittenResult?: FetchResult<any>;
  private lastWrittenVars?: WatchQueryOptions["variables"];

  public markResult<T>(
    result: FetchResult<T>,
    options: Pick<WatchQueryOptions,
      | "variables"
      | "fetchPolicy"
      | "errorPolicy">,
    allowCacheWrite: boolean,
  ) {
    this.graphQLErrors = isNonEmptyArray(result.errors) ? result.errors : [];

    if (options.fetchPolicy === 'no-cache') {
      this.diff = { result: result.data, complete: true };

    } else if (allowCacheWrite) {
      const ignoreErrors =
        options.errorPolicy === 'ignore' ||
        options.errorPolicy === 'all';
      let writeWithErrors = !graphQLResultHasError(result);
      if (!writeWithErrors && ignoreErrors && result.data) {
        writeWithErrors = true;
      }

      if (writeWithErrors) {
        // Using a transaction here so we have a chance to read the result
        // back from the cache before the watch callback fires as a result
        // of writeQuery, so we can store the new diff quietly and ignore
        // it when we receive it redundantly from the watch callback.
        this.cache.performTransaction(cache => {
          if (this.lastWrittenResult &&
              equal(result.data, this.lastWrittenResult.data) &&
              equal(options.variables, this.lastWrittenVars)) {
            // If result is the same as the last result we received from
            // the network (and the variables match too), avoid writing
            // result into the cache again. The wisdom of skipping this
            // cache write is far from obvious, since any cache write
            // could be the one that puts the cache back into a desired
            // state, fixing corruption or missing data. However, if we
            // always write every network result into the cache, we enable
            // feuds between queries competing to update the same data in
            // incompatible ways, which can lead to an endless cycle of
            // cache broadcasts and useless network requests. As with any
            // feud, eventually one side must step back from the brink,
            // letting the other side(s) have the last word(s). There may
            // be other points where we could break this cycle, such as
            // silencing the broadcast for cache.writeQuery (not a good
            // idea, since it just delays the feud a bit) or somehow
            // avoiding the network request that just happened (also bad,
            // because the server could return useful new data). All
            // options considered, skipping this cache write seems to be
            // the least damaging place to break the cycle, because it
            // reflects the intuition that we recently wrote this exact
            // result into the cache, so the cache *should* already/still
            // contain this data. If some other query has clobbered that
            // data in the meantime, that's too bad, but there will be no
            // winners if every query blindly reverts to its own version
            // of the data. This approach also gives the network a chance
            // to return new data, which will be written into the cache as
            // usual, notifying only those queries that are directly
            // affected by the cache updates, as usual. In the future, an
            // even more sophisticated cache could perhaps prevent or
            // mitigate the clobbering somehow, but that would make this
            // particular cache write even less important, and thus
            // skipping it would be even safer than it is today.
            if (this.diff && this.diff.complete) {
              // Reuse data from the last good (complete) diff that we
              // received, when possible.
              result.data = this.diff.result;
              return;
            }
            // If the previous this.diff was incomplete, fall through to
            // re-reading the latest data with cache.diff, below.
          } else {
            cache.writeQuery({
              query: this.document!,
              data: result.data as T,
              variables: options.variables,
            });
            this.lastWrittenResult = result;
            this.lastWrittenVars = options.variables;
          }

          const diff = cache.diff<T>({
            query: this.document!,
            variables: options.variables,
            returnPartialData: true,
            optimistic: true,
          });

          // Any time we're about to update this.diff, we need to make
          // sure we've started watching the cache.
          this.updateWatch(options.variables);

          // If we're allowed to write to the cache, and we can read a
          // complete result from the cache, update result.data to be the
          // result from the cache, rather than the raw network result.
          // Set without setDiff to avoid triggering a notify call, since
          // we have other ways of notifying for this result.
          this.diff = diff;
          if (diff.complete) {
            result.data = diff.result;
          }
        });

      } else {
        this.lastWrittenResult = this.lastWrittenVars = void 0;
      }
    }
  }

  public markReady() {
    this.networkError = null;
    return this.networkStatus = NetworkStatus.ready;
  }

  public markError(error: ApolloError) {
    this.networkStatus = NetworkStatus.error;
    this.lastWrittenResult = this.lastWrittenVars = void 0;

    if (error.graphQLErrors) {
      this.graphQLErrors = error.graphQLErrors;
    }

    if (error.networkError) {
      this.networkError = error.networkError;
    }

    return error;
  }
}
