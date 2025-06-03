import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";

import type { ApolloCache, Cache } from "@apollo/client/cache";
import type { FetchResult } from "@apollo/client/link";
import type { Unmasked } from "@apollo/client/masking";
import {
  DeepMerger,
  graphQLResultHasError,
  isNonEmptyArray,
  mergeIncrementalData,
} from "@apollo/client/utilities/internal";

import type { ObservableQuery } from "./ObservableQuery.js";
import type { QueryManager } from "./QueryManager.js";
import type { OperationVariables } from "./types.js";
import type { ErrorPolicy, WatchQueryOptions } from "./watchQueryOptions.js";

export const enum CacheWriteBehavior {
  FORBID,
  OVERWRITE,
  MERGE,
}

const destructiveMethodCounts = new WeakMap<ApolloCache, number>();

function wrapDestructiveCacheMethod(
  cache: ApolloCache,
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
  document: DocumentNode | null = null;
  lastRequestId = 1;
  variables?: Record<string, any>;

  private cache: ApolloCache;

  constructor(
    queryManager: QueryManager,
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
  }): this {
    if (!equal(query.variables, this.variables)) {
      this.resetDiff();
    }

    Object.assign(this, {
      document: query.document,
      variables: query.variables,
    });

    return this;
  }

  public getDiffOptions(variables = this.variables): Cache.DiffOptions {
    return {
      query: this.document!,
      variables,
      returnPartialData: true,
      optimistic: true,
    };
  }

  public readonly observableQuery: ObservableQuery<any, any> | null = null;
  setObservableQuery(oq: ObservableQuery<any, any> | null) {
    if (oq === this.observableQuery) return;
    (this as any).observableQuery = oq;
    if (oq) {
      oq["queryInfo"] = this;
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

  resetDiff() {
    this.lastDiff = void 0;
  }

  private lastDiff?: {
    diff: Cache.DiffResult<any>;
    options: Cache.DiffOptions;
  };

  public markResult<T>(
    result: FetchResult<T>,
    document: DocumentNode,
    options: {
      variables: OperationVariables;
      errorPolicy: ErrorPolicy;
    },
    cacheWriteBehavior: CacheWriteBehavior
  ) {
    // Cancel the pending notify timeout (if it exists) to prevent extraneous network
    // requests. To allow future notify timeouts, diff and dirty are reset as well.
    this.observableQuery?.["resetNotifications"]();

    if (cacheWriteBehavior === CacheWriteBehavior.FORBID) {
      const diffOptions = this.getDiffOptions(options.variables);
      const lastDiff =
        this.lastDiff && equal(diffOptions, this.lastDiff.options) ?
          this.lastDiff.diff
        : { result: null, complete: false };
      handleIncrementalResult(result, lastDiff);

      this.lastDiff = {
        diff: { result: result.data, complete: true },
        options: diffOptions,
      };
    } else {
      const lastDiff = this.cache.diff<any>(this.getDiffOptions());
      handleIncrementalResult(result, lastDiff);

      if (shouldWriteResult(result, options.errorPolicy)) {
        // Using a transaction here so we have a chance to read the result
        // back from the cache before the watch callback fires as a result
        // of writeQuery, so we can store the new diff quietly and ignore
        // it when we receive it redundantly from the watch callback.
        this.cache.batch({
          onWatchUpdated: (
            // all additional options on ObservableQuery.CacheWatchOptions are
            // optional so we can use the type here
            watch: ObservableQuery.CacheWatchOptions,
            diff
          ) => {
            if (watch.watcher === this.observableQuery) {
              // see comment on `lastOwnDiff` for explanation
              watch.lastOwnDiff = diff;
            }
          },
          update: (cache) => {
            if (this.shouldWrite(result, options.variables)) {
              cache.writeQuery({
                query: document,
                data: result.data as Unmasked<any>,
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
              if (lastDiff && lastDiff.complete) {
                // Reuse data from the last good (complete) diff that we
                // received, when possible.
                result.data = lastDiff.result;
                return;
              }
              // If the previous this.diff was incomplete, fall through to
              // re-reading the latest data with cache.diff, below.
            }

            const diffOptions = this.getDiffOptions(options.variables);
            const diff = cache.diff<T>(diffOptions);

            // If we're allowed to write to the cache, and we can read a
            // complete result from the cache, update result.data to be the
            // result from the cache, rather than the raw network result.
            // Set without setDiff to avoid triggering a notify call, since
            // we have other ways of notifying for this result.
            if (diff.complete) {
              result.data = diff.result;
            }
          },
        });
      } else {
        this.lastWrite = void 0;
      }
    }
  }
}

function handleIncrementalResult<T>(
  result: FetchResult<T>,
  lastDiff: Cache.DiffResult<any>
) {
  if ("incremental" in result && isNonEmptyArray(result.incremental)) {
    const mergedData = mergeIncrementalData(lastDiff.result, result);
    result.data = mergedData;

    // Detect the first chunk of a deferred query and merge it with existing
    // cache data. This ensures a `cache-first` fetch policy that returns
    // partial cache data or a `cache-and-network` fetch policy that already
    // has full data in the cache does not complain when trying to merge the
    // initial deferred server data with existing cache data.
  } else if ("hasNext" in result && result.hasNext) {
    const merger = new DeepMerger();
    result.data = merger.merge(lastDiff.result, result.data);
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
