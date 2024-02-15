import type { DocumentNode, GraphQLError } from "graphql";
import { equal } from "@wry/equality";

import type { Cache, ApolloCache } from "../cache/index.js";
import { DeepMerger } from "../utilities/index.js";
import { mergeIncrementalData } from "../utilities/index.js";
import type { WatchQueryOptions, ErrorPolicy } from "./watchQueryOptions.js";
import type { ObservableQuery } from "./ObservableQuery.js";
import { reobserveCacheFirst } from "./ObservableQuery.js";
import type { QueryListener } from "./types.js";
import type { FetchResult } from "../link/core/index.js";
import {
  isNonEmptyArray,
  graphQLResultHasError,
  canUseWeakMap,
} from "../utilities/index.js";
import { NetworkStatus, isNetworkRequestInFlight } from "./networkStatus.js";
import type { ApolloError } from "../errors/index.js";
import type { QueryManager } from "./QueryManager.js";

export type QueryStoreValue = Pick<
  QueryInfo,
  "variables" | "networkStatus" | "networkError" | "graphQLErrors"
>;

export const enum CacheWriteBehavior {
  FORBID,
  OVERWRITE,
  MERGE,
}

const destructiveMethodCounts = new (canUseWeakMap ? WeakMap : Map)<
  ApolloCache<any>,
  number
>();

function wrapDestructiveCacheMethod(
  cache: ApolloCache<any>,
  methodName: "evict" | "modify" | "reset"
) {
  const original = cache[methodName];
  if (typeof original === "function") {
    // @ts-expect-error this is just too generic to be typed correctly
    cache[methodName] = function () {
      destructiveMethodCounts.set(
        cache,
        // The %1e15 allows the count to wrap around to 0 safely every
        // quadrillion evictions, so there's no risk of overflow. To be
        // clear, this is more of a pedantic principle than something
        // that matters in any conceivable practical scenario.
        (destructiveMethodCounts.get(cache)! + 1) % 1e15
      );
      // @ts-expect-error this is just too generic to be typed correctly
      return original.apply(this, arguments);
    };
  }
}

function cancelNotifyTimeout(info: QueryInfo) {
  if (info["notifyTimeout"]) {
    clearTimeout(info["notifyTimeout"]);
    info["notifyTimeout"] = void 0;
  }
}

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
  variables?: Record<string, any>;
  networkStatus?: NetworkStatus;
  networkError?: Error | null;
  graphQLErrors?: ReadonlyArray<GraphQLError>;
  stopped = false;

  private cache: ApolloCache<any>;

  constructor(
    queryManager: QueryManager<any>,
    public readonly queryId = queryManager.generateQueryId()
  ) {
    const cache = (this.cache = queryManager.cache);

    // Track how often cache.evict is called, since we want eviction to
    // override the feud-stopping logic in the markResult method, by
    // causing shouldWrite to return true. Wrapping the cache.evict method
    // is a bit of a hack, but it saves us from having to make eviction
    // counting an official part of the ApolloCache API.
    if (!destructiveMethodCounts.has(cache)) {
      destructiveMethodCounts.set(cache, 0);
      wrapDestructiveCacheMethod(cache, "evict");
      wrapDestructiveCacheMethod(cache, "modify");
      wrapDestructiveCacheMethod(cache, "reset");
    }
  }

  public init(query: {
    document: DocumentNode;
    variables: Record<string, any> | undefined;
    // The initial networkStatus for this fetch, most often
    // NetworkStatus.loading, but also possibly fetchMore, poll, refetch,
    // or setVariables.
    networkStatus?: NetworkStatus;
    observableQuery?: ObservableQuery<any, any>;
    lastRequestId?: number;
  }): this {
    let networkStatus = query.networkStatus || NetworkStatus.loading;
    if (
      this.variables &&
      this.networkStatus !== NetworkStatus.loading &&
      !equal(this.variables, query.variables)
    ) {
      networkStatus = NetworkStatus.setVariables;
    }

    if (!equal(query.variables, this.variables)) {
      this.lastDiff = void 0;
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

  reset() {
    cancelNotifyTimeout(this);
    this.dirty = false;
  }

  resetDiff() {
    this.lastDiff = void 0;
  }

  getDiff(): Cache.DiffResult<any> {
    const options = this.getDiffOptions();

    if (this.lastDiff && equal(options, this.lastDiff.options)) {
      return this.lastDiff.diff;
    }

    this.updateWatch(this.variables);

    const oq = this.observableQuery;
    if (oq && oq.options.fetchPolicy === "no-cache") {
      return { complete: false };
    }

    const diff = this.cache.diff(options);
    this.updateLastDiff(diff, options);
    return diff;
  }

  private lastDiff?: {
    diff: Cache.DiffResult<any>;
    options: Cache.DiffOptions;
  };

  private updateLastDiff(
    diff: Cache.DiffResult<any> | null,
    options?: Cache.DiffOptions
  ) {
    this.lastDiff =
      diff ?
        {
          diff,
          options: options || this.getDiffOptions(),
        }
      : void 0;
  }

  private getDiffOptions(variables = this.variables): Cache.DiffOptions {
    return {
      query: this.document!,
      variables,
      returnPartialData: true,
      optimistic: true,
      canonizeResults: this.observableQuery?.options.canonizeResults,
    };
  }

  setDiff(diff: Cache.DiffResult<any> | null) {
    const oldDiff = this.lastDiff && this.lastDiff.diff;

    // If we do not tolerate partial results, skip this update to prevent it
    // from being reported. This prevents a situtuation where a query that
    // errors and another succeeds with overlapping data does not report the
    // partial data result to the errored query.
    //
    // See https://github.com/apollographql/apollo-client/issues/11400 for more
    // information on this issue.
    if (
      diff &&
      !diff.complete &&
      !this.observableQuery?.options.returnPartialData &&
      // In the case of a cache eviction, the diff will become partial so we
      // schedule a notification to send a network request (this.oqListener) to
      // go and fetch the missing data.
      !(oldDiff && oldDiff.complete)
    ) {
      return;
    }

    this.updateLastDiff(diff);

    if (!this.dirty && !equal(oldDiff && oldDiff.result, diff && diff.result)) {
      this.dirty = true;
      if (!this.notifyTimeout) {
        this.notifyTimeout = setTimeout(() => this.notify(), 0);
      }
    }
  }

  public readonly observableQuery: ObservableQuery<any, any> | null = null;
  private oqListener?: QueryListener;

  setObservableQuery(oq: ObservableQuery<any, any> | null) {
    if (oq === this.observableQuery) return;

    if (this.oqListener) {
      this.listeners.delete(this.oqListener);
    }

    (this as any).observableQuery = oq;

    if (oq) {
      oq["queryInfo"] = this;
      this.listeners.add(
        (this.oqListener = () => {
          const diff = this.getDiff();
          if (diff.fromOptimisticTransaction) {
            // If this diff came from an optimistic transaction, deliver the
            // current cache data to the ObservableQuery, but don't perform a
            // reobservation, since oq.reobserveCacheFirst might make a network
            // request, and we never want to trigger network requests in the
            // middle of optimistic updates.
            oq["observe"]();
          } else {
            // Otherwise, make the ObservableQuery "reobserve" the latest data
            // using a temporary fetch policy of "cache-first", so complete cache
            // results have a chance to be delivered without triggering additional
            // network requests, even when options.fetchPolicy is "network-only"
            // or "cache-and-network". All other fetch policies are preserved by
            // this method, and are handled by calling oq.reobserve(). If this
            // reobservation is spurious, isDifferentFromLastResult still has a
            // chance to catch it before delivery to ObservableQuery subscribers.
            reobserveCacheFirst(oq);
          }
        })
      );
    } else {
      delete this.oqListener;
    }
  }

  notify() {
    cancelNotifyTimeout(this);

    if (this.shouldNotify()) {
      this.listeners.forEach((listener) => listener(this));
    }

    this.dirty = false;
  }

  private shouldNotify() {
    if (!this.dirty || !this.listeners.size) {
      return false;
    }

    if (isNetworkRequestInFlight(this.networkStatus) && this.observableQuery) {
      const { fetchPolicy } = this.observableQuery.options;
      if (fetchPolicy !== "cache-only" && fetchPolicy !== "cache-and-network") {
        return false;
      }
    }

    return true;
  }

  public stop() {
    if (!this.stopped) {
      this.stopped = true;

      // Cancel the pending notify timeout
      this.reset();

      this.cancel();
      // Revert back to the no-op version of cancel inherited from
      // QueryInfo.prototype.
      this.cancel = QueryInfo.prototype.cancel;

      const oq = this.observableQuery;
      if (oq) oq.stopPolling();
    }
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

    const watchOptions: Cache.WatchOptions = {
      // Although this.getDiffOptions returns Cache.DiffOptions instead of
      // Cache.WatchOptions, all the overlapping options should be the same, so
      // we can reuse getDiffOptions here, for consistency.
      ...this.getDiffOptions(variables),
      watcher: this,
      callback: (diff) => this.setDiff(diff),
    };

    if (!this.lastWatch || !equal(watchOptions, this.lastWatch)) {
      this.cancel();
      this.cancel = this.cache.watch((this.lastWatch = watchOptions));
    }
  }

  private lastWrite?: {
    result: FetchResult<any>;
    variables: WatchQueryOptions["variables"];
    dmCount: number | undefined;
  };

  public resetLastWrite() {
    this.lastWrite = void 0;
  }

  private shouldWrite(
    result: FetchResult<any>,
    variables: WatchQueryOptions["variables"]
  ) {
    const { lastWrite } = this;
    return !(
      lastWrite &&
      // If cache.evict has been called since the last time we wrote this
      // data into the cache, there's a chance writing this result into
      // the cache will repair what was evicted.
      lastWrite.dmCount === destructiveMethodCounts.get(this.cache) &&
      equal(variables, lastWrite.variables) &&
      equal(result.data, lastWrite.result.data)
    );
  }

  public markResult<T>(
    result: FetchResult<T>,
    document: DocumentNode,
    options: Pick<
      WatchQueryOptions,
      "variables" | "fetchPolicy" | "errorPolicy"
    >,
    cacheWriteBehavior: CacheWriteBehavior
  ) {
    const merger = new DeepMerger();
    const graphQLErrors =
      isNonEmptyArray(result.errors) ? result.errors.slice(0) : [];

    // Cancel the pending notify timeout (if it exists) to prevent extraneous network
    // requests. To allow future notify timeouts, diff and dirty are reset as well.
    this.reset();

    if ("incremental" in result && isNonEmptyArray(result.incremental)) {
      const mergedData = mergeIncrementalData(this.getDiff().result, result);
      result.data = mergedData;

      // Detect the first chunk of a deferred query and merge it with existing
      // cache data. This ensures a `cache-first` fetch policy that returns
      // partial cache data or a `cache-and-network` fetch policy that already
      // has full data in the cache does not complain when trying to merge the
      // initial deferred server data with existing cache data.
    } else if ("hasNext" in result && result.hasNext) {
      const diff = this.getDiff();
      result.data = merger.merge(diff.result, result.data);
    }

    this.graphQLErrors = graphQLErrors;

    if (options.fetchPolicy === "no-cache") {
      this.updateLastDiff(
        { result: result.data, complete: true },
        this.getDiffOptions(options.variables)
      );
    } else if (cacheWriteBehavior !== CacheWriteBehavior.FORBID) {
      if (shouldWriteResult(result, options.errorPolicy)) {
        // Using a transaction here so we have a chance to read the result
        // back from the cache before the watch callback fires as a result
        // of writeQuery, so we can store the new diff quietly and ignore
        // it when we receive it redundantly from the watch callback.
        this.cache.performTransaction((cache) => {
          if (this.shouldWrite(result, options.variables)) {
            cache.writeQuery({
              query: document,
              data: result.data as T,
              variables: options.variables,
              overwrite: cacheWriteBehavior === CacheWriteBehavior.OVERWRITE,
            });

            this.lastWrite = {
              result,
              variables: options.variables,
              dmCount: destructiveMethodCounts.get(this.cache),
            };
          } else {
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
            if (this.lastDiff && this.lastDiff.diff.complete) {
              // Reuse data from the last good (complete) diff that we
              // received, when possible.
              result.data = this.lastDiff.diff.result;
              return;
            }
            // If the previous this.diff was incomplete, fall through to
            // re-reading the latest data with cache.diff, below.
          }

          const diffOptions = this.getDiffOptions(options.variables);
          const diff = cache.diff<T>(diffOptions);

          // In case the QueryManager stops this QueryInfo before its
          // results are delivered, it's important to avoid restarting the
          // cache watch when markResult is called. We also avoid updating
          // the watch if we are writing a result that doesn't match the current
          // variables to avoid race conditions from broadcasting the wrong
          // result.
          if (!this.stopped && equal(this.variables, options.variables)) {
            // Any time we're about to update this.diff, we need to make
            // sure we've started watching the cache.
            this.updateWatch(options.variables);
          }

          // If we're allowed to write to the cache, and we can read a
          // complete result from the cache, update result.data to be the
          // result from the cache, rather than the raw network result.
          // Set without setDiff to avoid triggering a notify call, since
          // we have other ways of notifying for this result.
          this.updateLastDiff(diff, diffOptions);
          if (diff.complete) {
            result.data = diff.result;
          }
        });
      } else {
        this.lastWrite = void 0;
      }
    }
  }

  public markReady() {
    this.networkError = null;
    return (this.networkStatus = NetworkStatus.ready);
  }

  public markError(error: ApolloError) {
    this.networkStatus = NetworkStatus.error;
    this.lastWrite = void 0;

    this.reset();

    if (error.graphQLErrors) {
      this.graphQLErrors = error.graphQLErrors;
    }

    if (error.networkError) {
      this.networkError = error.networkError;
    }

    return error;
  }
}

export function shouldWriteResult<T>(
  result: FetchResult<T>,
  errorPolicy: ErrorPolicy = "none"
) {
  const ignoreErrors = errorPolicy === "ignore" || errorPolicy === "all";
  let writeWithErrors = !graphQLResultHasError(result);
  if (!writeWithErrors && ignoreErrors && result.data) {
    writeWithErrors = true;
  }
  return writeWithErrors;
}
