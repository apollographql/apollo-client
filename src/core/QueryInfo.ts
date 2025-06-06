import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";

import type { ApolloCache, Cache } from "@apollo/client/cache";
import type { FetchResult } from "@apollo/client/link";
import type { Unmasked } from "@apollo/client/masking";
import {
  DeepMerger,
  getOperationName,
  graphQLResultHasError,
  isExecutionPatchIncrementalResult,
  isExecutionPatchResult,
  isNonEmptyArray,
  mergeIncrementalData,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import type { IgnoreModifier } from "../cache/core/types/common.js";

import type { ObservableQuery } from "./ObservableQuery.js";
import type { QueryManager } from "./QueryManager.js";
import type {
  DefaultContext,
  InternalRefetchQueriesInclude,
  MutationUpdaterFunction,
  OnQueryUpdated,
  OperationVariables,
  TypedDocumentNode,
} from "./types.js";
import type {
  ErrorPolicy,
  FetchPolicy,
  MutationFetchPolicy,
  MutationOptions,
  WatchQueryOptions,
} from "./watchQueryOptions.js";

type UpdateQueries<TData> = MutationOptions<TData, any, any>["updateQueries"];

const IGNORE = {} as IgnoreModifier;

export const enum CacheWriteBehavior {
  FORBID,
  OVERWRITE,
  MERGE,
}

export interface LastWrite {
  result: FetchResult<any>;
  variables: WatchQueryOptions["variables"];
  dmCount: number | undefined;
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

// A QueryInfo object represents a single network request, either initiated
// from the QueryManager or from an ObservableQuery.
// It will only ever be used for a single network call.
// It is responsible for reporting results to the cache, merging and in a no-cache
// scenario accumulating the response.
export class QueryInfo {
  document: DocumentNode | null = null;
  // TODO remove soon - this should be able to be handled by cancelling old operations before starting new ones
  lastRequestId = 1;
  variables?: Record<string, any>;

  private cache: ApolloCache;
  private queryManager: Pick<
    QueryManager,
    | "getObservableQueries"
    | "refetchQueries"
    | "getDocumentInfo"
    | "broadcastQueries"
  >;
  public queryId: string;
  // TODO should be private
  public readonly observableQuery?: ObservableQuery<any, any>;

  constructor({
    queryManager,
    observableQuery,
  }: {
    queryManager: QueryManager;
    queryId?: string;
    observableQuery?: ObservableQuery<any, any>;
  }) {
    const cache = (this.cache = queryManager.cache);
    this.queryId = queryManager.generateQueryId();
    this.observableQuery = observableQuery;
    this.queryManager = queryManager;

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
    this.document = query.document;
    this.variables = query.variables;

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

  /** @internal
   * For feud-preventing behaviour, `lastWrite` should be shared by all `QueryInfo` instances of an `ObservableQuery`.
   * In the case of a standalone `QueryInfo`, we will keep a local version.
   */
  public _lastWrite?: LastWrite;
  private get lastWrite(): LastWrite | undefined {
    return (this.observableQuery || this)._lastWrite;
  }
  private set lastWrite(value: LastWrite | undefined) {
    (this.observableQuery || this)._lastWrite = value;
  }

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

  public markMutationResult<
    TData,
    TVariables extends OperationVariables,
    TCache extends ApolloCache,
  >(
    mutation: {
      mutationId: string;
      result: FetchResult<TData>;
      document: DocumentNode;
      variables?: TVariables;
      fetchPolicy?: MutationFetchPolicy;
      errorPolicy: ErrorPolicy;
      context?: DefaultContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TCache>;
      awaitRefetchQueries?: boolean;
      refetchQueries?: InternalRefetchQueriesInclude;
      removeOptimistic?: string;
      onQueryUpdated?: OnQueryUpdated<any>;
      keepRootFields?: boolean;
    },
    cache = this.cache
  ): Promise<FetchResult<TData>> {
    let { result } = mutation;
    const cacheWrites: Cache.WriteOptions[] = [];
    const skipCache = mutation.fetchPolicy === "no-cache";

    if (!skipCache && shouldWriteResult(result, mutation.errorPolicy)) {
      if (!isExecutionPatchIncrementalResult(result)) {
        cacheWrites.push({
          result: result.data,
          dataId: "ROOT_MUTATION",
          query: mutation.document,
          variables: mutation.variables,
        });
      }
      if (
        isExecutionPatchIncrementalResult(result) &&
        isNonEmptyArray(result.incremental)
      ) {
        const diff = cache.diff<TData>({
          id: "ROOT_MUTATION",
          // The cache complains if passed a mutation where it expects a
          // query, so we transform mutations and subscriptions to queries
          // (only once, thanks to this.transformCache).
          query: this.queryManager.getDocumentInfo(mutation.document).asQuery,
          variables: mutation.variables,
          optimistic: false,
          returnPartialData: true,
        });
        let mergedData;
        if (diff.result) {
          mergedData = mergeIncrementalData(diff.result, result);
        }
        if (typeof mergedData !== "undefined") {
          // cast the ExecutionPatchResult to FetchResult here since
          // ExecutionPatchResult never has `data` when returned from the server
          (result as FetchResult).data = mergedData;
          cacheWrites.push({
            result: mergedData,
            dataId: "ROOT_MUTATION",
            query: mutation.document,
            variables: mutation.variables,
          });
        }
      }

      const { updateQueries } = mutation;
      if (updateQueries) {
        this.queryManager
          .getObservableQueries("all")
          .forEach((observableQuery) => {
            const queryName = observableQuery && observableQuery.queryName;
            if (
              !queryName ||
              !Object.hasOwnProperty.call(updateQueries, queryName)
            ) {
              return;
            }
            const updater = updateQueries[queryName];
            const { query: document, variables } = observableQuery;

            // Read the current query result from the store.
            const { result: currentQueryResult, complete } =
              observableQuery.getCacheDiff({ optimistic: false });

            if (complete && currentQueryResult) {
              // Run our reducer using the current query result and the mutation result.
              const nextQueryResult = updater(currentQueryResult, {
                mutationResult: result as FetchResult<Unmasked<TData>>,
                queryName: (document && getOperationName(document)) || void 0,
                queryVariables: variables!,
              });

              // Write the modified result back into the store if we got a new result.
              if (nextQueryResult) {
                cacheWrites.push({
                  result: nextQueryResult,
                  dataId: "ROOT_QUERY",
                  query: document!,
                  variables,
                });
              }
            }
          });
      }
    }

    if (
      cacheWrites.length > 0 ||
      (mutation.refetchQueries || "").length > 0 ||
      mutation.update ||
      mutation.onQueryUpdated ||
      mutation.removeOptimistic
    ) {
      const results: any[] = [];

      this.queryManager
        .refetchQueries({
          updateCache: (cache) => {
            if (!skipCache) {
              cacheWrites.forEach((write) => cache.write(write));
            }

            // If the mutation has some writes associated with it then we need to
            // apply those writes to the store by running this reducer again with
            // a write action.
            const { update } = mutation;
            // Determine whether result is a SingleExecutionResult,
            // or the final ExecutionPatchResult.
            const isFinalResult =
              !isExecutionPatchResult(result) ||
              (isExecutionPatchIncrementalResult(result) && !result.hasNext);

            if (update) {
              if (!skipCache) {
                // Re-read the ROOT_MUTATION data we just wrote into the cache
                // (the first cache.write call in the cacheWrites.forEach loop
                // above), so field read functions have a chance to run for
                // fields within mutation result objects.
                const diff = cache.diff<TData>({
                  id: "ROOT_MUTATION",
                  // The cache complains if passed a mutation where it expects a
                  // query, so we transform mutations and subscriptions to queries
                  // (only once, thanks to this.transformCache).
                  query: this.queryManager.getDocumentInfo(mutation.document)
                    .asQuery,
                  variables: mutation.variables,
                  optimistic: false,
                  returnPartialData: true,
                });

                if (diff.complete) {
                  result = { ...(result as FetchResult), data: diff.result };
                  if ("incremental" in result) {
                    delete result.incremental;
                  }
                  if ("hasNext" in result) {
                    delete result.hasNext;
                  }
                }
              }

              // If we've received the whole response,
              // either a SingleExecutionResult or the final ExecutionPatchResult,
              // call the update function.
              if (isFinalResult) {
                update(
                  cache as TCache,
                  result as FetchResult<Unmasked<TData>>,
                  {
                    context: mutation.context,
                    variables: mutation.variables,
                  }
                );
              }
            }

            // TODO Do this with cache.evict({ id: 'ROOT_MUTATION' }) but make it
            // shallow to allow rolling back optimistic evictions.
            if (!skipCache && !mutation.keepRootFields && isFinalResult) {
              cache.modify({
                id: "ROOT_MUTATION",
                fields(value, { fieldName, DELETE }) {
                  return fieldName === "__typename" ? value : DELETE;
                },
              });
            }
          },

          include: mutation.refetchQueries,

          // Write the final mutation.result to the root layer of the cache.
          optimistic: false,

          // Remove the corresponding optimistic layer at the same time as we
          // write the final non-optimistic result.
          removeOptimistic: mutation.removeOptimistic,

          // Let the caller of client.mutate optionally determine the refetching
          // behavior for watched queries after the mutation.update function runs.
          // If no onQueryUpdated function was provided for this mutation, pass
          // null instead of undefined to disable the default refetching behavior.
          onQueryUpdated: mutation.onQueryUpdated || null,
        })
        .forEach((result) => results.push(result));

      if (mutation.awaitRefetchQueries || mutation.onQueryUpdated) {
        // Returning a promise here makes the mutation await that promise, so we
        // include results in that promise's work if awaitRefetchQueries or an
        // onQueryUpdated function was specified.
        return Promise.all(results).then(() => result);
      }
    }

    return Promise.resolve(result);
  }

  public markMutationOptimistic<
    TData,
    TVariables extends OperationVariables,
    TCache extends ApolloCache,
  >(
    optimisticResponse: any,
    mutation: {
      mutationId: string;
      document: DocumentNode;
      variables?: TVariables;
      fetchPolicy?: MutationFetchPolicy;
      errorPolicy: ErrorPolicy;
      context?: DefaultContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TCache>;
      keepRootFields?: boolean;
    }
  ) {
    const data =
      typeof optimisticResponse === "function" ?
        optimisticResponse(mutation.variables, { IGNORE })
      : optimisticResponse;

    if (data === IGNORE) {
      return false;
    }

    this.cache.recordOptimisticTransaction((cache) => {
      try {
        this.markMutationResult<TData, TVariables, TCache>(
          {
            ...mutation,
            result: { data },
          },
          cache
        );
      } catch (error) {
        invariant.error(error);
      }
    }, mutation.mutationId);

    return true;
  }

  public markSubscriptionResult<TData, TVariables extends OperationVariables>({
    result,
    document,
    variables,
    errorPolicy,
    fetchPolicy,
  }: {
    result: FetchResult<TData>;
    document: DocumentNode | TypedDocumentNode<TData, TVariables>;
    variables: TVariables;
    fetchPolicy?: FetchPolicy;
    errorPolicy: ErrorPolicy;
  }) {
    if (fetchPolicy !== "no-cache") {
      if (shouldWriteResult(result, errorPolicy)) {
        this.cache.write({
          query: document,
          result: result.data as any,
          dataId: "ROOT_SUBSCRIPTION",
          variables: variables,
        });
      }

      this.queryManager.broadcastQueries();
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

function shouldWriteResult<T>(
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
