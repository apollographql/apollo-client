import { ExecutionResult, DocumentNode, GraphQLError } from 'graphql';
import { equal } from "@wry/equality";

import { Cache } from '../cache/core/types/Cache';
import { ApolloCache } from '../cache/core/cache';
import { WatchQueryOptions } from './watchQueryOptions';
import { ObservableQuery } from './ObservableQuery';
import { QueryListener } from './types';
import { ObservableSubscription } from '../utilities/observables/Observable';
import { isNonEmptyArray } from '../utilities/common/arrays';
import { graphQLResultHasError } from '../utilities/common/errorHandling';
import {
  NetworkStatus,
  isNetworkRequestInFlight,
} from './networkStatus';
import { ApolloError } from '../errors/ApolloError';

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
// Results are reported asynchronously whenever setDirty marks the
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

  public setDirty(): this {
    if (!this.dirty) {
      this.dirty = true;
      if (!this.notifyTimeout) {
        this.notifyTimeout = setTimeout(() => this.notify(), 0);
      }
    }
    return this;
  }

  private notifyTimeout?: ReturnType<typeof setTimeout>;

  private diff: Cache.DiffResult<any> | null = null;

  setDiff(diff: Cache.DiffResult<any> | null) {
    const oldDiff = this.diff;
    this.diff = diff;
    if (!this.dirty && diff?.result !== oldDiff?.result) {
      this.setDirty();
    }
  }

  getDiff() {
    if (!this.diff) {
      const oq = this.observableQuery;
      const lastResult = oq && oq.getLastResult();
      const lastError = oq && oq.getLastError();
      const fetchPolicy = oq && oq.options.fetchPolicy || "cache-first";
      const errorPolicy = this.getErrorPolicy();
      const errorStatusChanged =
        errorPolicy !== 'none' &&
        (lastError && lastError.graphQLErrors) !== this.graphQLErrors;

      if (lastResult && lastResult.data && !errorStatusChanged) {
        this.diff = {
          result: lastResult.data,
          complete: true,
        };
      } else if (fetchPolicy !== "no-cache" &&
                 fetchPolicy !== "network-only") {
        this.diff = this.cache.diff({
          query: this.document as DocumentNode,
          variables: this.variables,
          returnPartialData: true,
          optimistic: true,
        });
      }
    }

    return this.diff!;
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
      this.listeners.add(this.oqListener = () => oq.reobserve());
    } else {
      delete this.oqListener;
    }
  }

  private getErrorPolicy() {
    const oq = this.observableQuery;
    return oq && oq.options.errorPolicy || "none";
  }

  notify() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = void 0;
    }

    if (this.shouldNotify() && this.getDiff()) {
      this.listeners.forEach(listener => listener(this));
    }

    this.dirty = false;
  }

  private shouldNotify() {
    if (!this.dirty || !this.listeners.size) {
      return false;
    }

    if (!this.observableQuery) {
      return true;
    }

    const {
      fetchPolicy,
      returnPartialData,
      notifyOnNetworkStatusChange,
    } = this.observableQuery.options;

    if (fetchPolicy === "standby") {
      return false;
    }

    if (isNetworkRequestInFlight(this.networkStatus)) {
      const lastResult = this.observableQuery.getLastResult();

      const networkStatusChanged = !!(
        lastResult &&
        lastResult.networkStatus !== this.networkStatus
      );

      const shouldNotifyIfLoading =
        returnPartialData ||
        this.networkStatus === NetworkStatus.setVariables ||
        (networkStatusChanged && notifyOnNetworkStatusChange) ||
        fetchPolicy === 'cache-only' ||
        fetchPolicy === 'cache-and-network';

      if (!shouldNotifyIfLoading) {
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

    this.variables =
    this.networkStatus =
    this.networkError =
    this.graphQLErrors = void 0;

    const oq = this.observableQuery;
    if (oq) oq.stopPolling();
  }

  // This method can be overridden for a given instance.
  public cancel() {}

  public updateWatch(options: WatchQueryOptions): this {
    // TODO Always cancelling here may be bad because it disrupts
    // cache.watch continuity.
    this.cancel();

    this.cancel = this.cache.watch({
      query: this.document!,
      variables: options.variables,
      optimistic: true,
      callback: diff => this.setDiff(diff),
    });

    return this;
  }

  public markResult<T>(
    result: ExecutionResult<T>,
    { variables,
      fetchPolicy,
      errorPolicy,
    }: Pick<WatchQueryOptions,
      | "variables"
      | "fetchPolicy"
      | "errorPolicy"
      >,
    allowCacheWrite: boolean,
  ) {
    if (fetchPolicy === 'no-cache') {
      this.diff = { result: result.data, complete: true };

    } else if (allowCacheWrite) {
      const ignoreErrors = errorPolicy === 'ignore' || errorPolicy === 'all';
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
          cache.writeQuery({
            query: this.document!,
            data: result.data as T,
            variables,
          });

          const diff = cache.diff<T>({
            query: this.document!,
            variables,
            returnPartialData: true,
            optimistic: true,
          });

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
      }
    }

    this.graphQLErrors = isNonEmptyArray(result.errors) ? result.errors : [];
  }

  public markReady() {
    this.networkError = null;
    return this.networkStatus = NetworkStatus.ready;
  }

  public markError(error: ApolloError) {
    this.networkStatus = NetworkStatus.error;

    if (error.graphQLErrors) {
      this.graphQLErrors = error.graphQLErrors;
    }

    if (error.networkError) {
      this.networkError = error.networkError;
    }

    return error;
  }
}
