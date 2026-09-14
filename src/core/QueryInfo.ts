import { Trie } from "@wry/trie";
import type { DocumentNode, FormattedExecutionResult } from "graphql";

import type {
  Cache,
  DiffIncrementalInfo,
  IgnoreModifier,
} from "@apollo/client/cache";
import type { Incremental } from "@apollo/client/incremental";
import type { ApolloLink } from "@apollo/client/link";
import type { Unmasked } from "@apollo/client/masking";
import type { DeepPartial } from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type { ExtensionsWithStreamInfo } from "@apollo/client/utilities/internal";
import {
  getOperationName,
  graphQLResultHasError,
  handleIncrementalSymbol,
  hasDirectives,
  toDiffWithDataState,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import type { ApolloClient } from "./ApolloClient.js";
import { NetworkStatus } from "./networkStatus.js";
import type { ObservableQuery } from "./ObservableQuery.js";
import type { QueryManager } from "./QueryManager.js";
import type {
  DataValue,
  DefaultContext,
  InternalRefetchQueriesInclude,
  MutationQueryReducer,
  MutationUpdaterFunction,
  NormalizedExecutionResult,
  OnQueryUpdated,
  OperationVariables,
  TypedDocumentNode,
} from "./types.js";
import type {
  ErrorPolicy,
  WatchQueryFetchPolicy,
} from "./watchQueryOptions.js";

type UpdateQueries<TData> = ApolloClient.MutateOptions<
  TData,
  any,
  any
>["updateQueries"];

const IGNORE = {} as IgnoreModifier;

export const enum CacheWriteBehavior {
  FORBID,
  OVERWRITE,
  MERGE,
}

interface OperationInfo<
  TData,
  TVariables extends OperationVariables,
  AllowedCacheWriteBehavior = CacheWriteBehavior,
> {
  document: DocumentNode | TypedDocumentNode<TData, TVariables>;
  variables: TVariables;
  errorPolicy: ErrorPolicy;
  cacheWriteBehavior: AllowedCacheWriteBehavior;
  returnPartialData?: boolean | undefined;
}

interface MarkQueryResult<TData, TExtensions>
  extends FormattedExecutionResult<TData, TExtensions> {
  dataState: "empty" | "partial" | "streaming" | "complete";
}

const queryInfoIds = new WeakMap<QueryManager, number>();

// A QueryInfo object represents a single network request, either initiated
// from the QueryManager or from an ObservableQuery.
// It will only ever be used for a single network call.
// It is responsible for reporting results to the cache, merging and in a no-cache
// scenario accumulating the response.
export class QueryInfo<
  TData,
  TVariables extends OperationVariables = OperationVariables,
  TCache extends Cache.Implementation = Cache.Implementation,
> {
  private cache: TCache;
  private queryManager: Pick<
    QueryManager,
    | "getObservableQueries"
    | "refetchQueries"
    | "getDocumentInfo"
    | "broadcastQueries"
    | "incrementalHandler"
  >;
  public readonly id: string;
  private readonly observableQuery?: ObservableQuery<any, any>;
  private incremental?: Incremental.IncrementalRequest<
    Record<string, unknown>,
    DataValue.Complete<TData> | DataValue.Streaming<TData>
  >;

  constructor(
    queryManager: QueryManager,
    observableQuery?: ObservableQuery<any, any>
  ) {
    this.cache = queryManager.cache as TCache;
    const id = (queryInfoIds.get(queryManager) || 0) + 1;
    queryInfoIds.set(queryManager, id);
    this.id = id + "";
    this.observableQuery = observableQuery;
    this.queryManager = queryManager;
  }

  get hasNext() {
    return this.incremental ? this.incremental.hasNext : false;
  }

  get incrementalHandler() {
    return this.queryManager.incrementalHandler;
  }

  private maybeHandleIncrementalResult(
    cacheData: TData | DeepPartial<TData> | undefined | null,
    incoming: ApolloLink.Result<TData>,
    query: DocumentNode
  ): FormattedExecutionResult<
    DataValue.Complete<TData> | DataValue.Streaming<TData>,
    ExtensionsWithStreamInfo
  > {
    if (this.incrementalHandler.isIncrementalResult(incoming)) {
      this.incremental ||= this.incrementalHandler.startRequest<
        TData & Record<string, unknown>
      >({
        query,
      }) as Incremental.IncrementalRequest<
        Record<string, unknown>,
        DataValue.Complete<TData> | DataValue.Streaming<TData>
      >;

      return this.incremental.handle(cacheData, incoming);
    }
    return incoming;
  }

  public markQueryResult(
    incoming: ApolloLink.Result<TData>,
    {
      document: query,
      variables,
      errorPolicy,
      cacheWriteBehavior,
      returnPartialData,
      fetchPolicy,
      networkStatus,
      prunePendingDeferFragments: prune,
    }: OperationInfo<TData, TVariables> & {
      fetchPolicy: WatchQueryFetchPolicy;
      networkStatus: NetworkStatus;
      prunePendingDeferFragments: boolean;
    }
  ): MarkQueryResult<
    DataValue.Complete<TData> | DataValue.Streaming<TData>,
    ExtensionsWithStreamInfo
  > {
    const diffOptions = {
      query,
      variables,
      optimistic: true,
    };

    // Cancel the pending notify timeout (if it exists) to prevent extraneous network
    // requests. To allow future notify timeouts, diff and dirty are reset as well.
    this.observableQuery?.["resetNotifications"]();

    const skipCache = cacheWriteBehavior === CacheWriteBehavior.FORBID;
    const diff =
      skipCache ? undefined : (
        this.getDiff(
          {
            ...diffOptions,
            // We usually request partial data to ensure the network incremental
            // result is merged with all existing data (especially true to
            // maintain @stream arrays with partial list items in the right order
            // or when chunk might otherwise replace a partial non-normalized
            // object), but if we are about to throw away the result anyways due
            // to the error policy (which early returns below), prune any
            // pending boundaries so that CombinedGraphQLErrors contains the
            // right `data` value.
            returnPartialData:
              errorPolicy !== "none" ||
              !this.incrementalHandler.extractErrors(incoming)?.length,
          },
          this.getIncrementalInfo({ prune })
        )
      );

    const incrementalResult = this.maybeHandleIncrementalResult(
      diff?.result,
      incoming,
      query
    );

    let result: MarkQueryResult<any, ExtensionsWithStreamInfo> = {
      ...incrementalResult,
      dataState: incrementalResult.data == null ? "empty" : "complete",
    };

    const hasPendingDefer = this.incremental
      ?.getPendingWithInfo?.()
      .some((pending) => pending.type === "defer" && !pending.delivered);

    if (
      hasPendingDefer ||
      // The Defer20220824Handler cannot track pending/completed incremental
      // chunks due to its data format so we naively set dataState to
      // streaming if we are still processing chunks. The only case where
      // streaming is incorrect and should actually be complete is when
      // both a @defer and @stream boundary is present and the @defer chunk
      // has completed before the `@stream` array.
      //
      // Assigning the naive "streaming" value avoids a much more expensive
      // pass over `result.data` that would otherwise need to traverse the
      // selection sets and evaluate the data object at each defer boundary
      // to see if it fulfills the selection set. For such a narrow case where
      // its incorrect on a format that is now outdated is not worth the
      // fix so we are ok with reporting a `streaming` here.
      (!this.incremental?.getPendingWithInfo &&
        this.hasNext &&
        hasDirectives(["defer"], query))
    ) {
      result.dataState = "streaming";
    }

    if (skipCache || !shouldWriteResult(result, errorPolicy)) {
      return result;
    }

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
        cache.writeQuery({
          query,
          data: result.data as Unmasked<any>,
          variables,
          overwrite: cacheWriteBehavior === CacheWriteBehavior.OVERWRITE,
          extensions: result.extensions,
        });

        const { dataState, result: diffResult } = this.getDiff(
          {
            ...diffOptions,
            returnPartialData:
              returnPartialData &&
              // Never deliver partial data for network-only requests
              (fetchPolicy !== "network-only" ||
                networkStatus === NetworkStatus.refetch),
          },
          this.getIncrementalInfo({ prune })
        );

        if (
          dataState === "complete" ||
          dataState === "streaming" ||
          (returnPartialData && dataState === "partial")
        ) {
          result = { ...result, data: diffResult, dataState };
        } else if (
          __DEV__ &&
          // A result that is still streaming is expected to read back
          // incomplete until the remaining chunks arrive.
          !this.hasNext
        ) {
          warnAboutPartialCacheResult(
            query,
            result.data,
            // Always show the partial result for debugging, otherwise the user
            // sees `null` when `returnPartialData` is false which isn't helpful
            // for figuring out where the problem is.
            cache.diff({ ...diffOptions, returnPartialData: true })
          );
        }
      },
    });

    return result;
  }

  private getIncrementalInfo({ prune }: { prune: boolean }) {
    const pending = this.incremental?.getPendingWithInfo?.() ?? [];
    const streamInfo = this.incremental?.streamInfo;
    const incrementalInfo: DiffIncrementalInfo = { streamInfo };

    // We don't want to deliver stream items or complete defer boundaries
    // for a network-only request if they haven't yet streamed from the
    // network. We record all the still-pending paths so that cache.diff
    // can prune complete defer/stream boundaries at those paths.
    if (prune) {
      for (const item of pending) {
        if (item.type === "defer" && !item.delivered) {
          incrementalInfo.deferInfo ||= new Trie(true, () => true);
          incrementalInfo.deferInfo.lookupArray(
            item.path.concat(item.label || [])
          );
        } else if (streamInfo && item.type === "stream") {
          streamInfo.lookupArray(item.path as any[]).state.truncate = true;
        }
      }
    }

    return incrementalInfo;
  }

  getDiff(
    options: Cache.DiffOptions<TData>,
    incrementalInfo?: DiffIncrementalInfo
  ) {
    return toDiffWithDataState(
      this.cache.diff({
        ...options,
        [handleIncrementalSymbol]: incrementalInfo,
      })
    );
  }

  public markMutationResult(
    incoming: ApolloLink.Result<TData>,
    mutation: OperationInfo<
      TData,
      TVariables,
      CacheWriteBehavior.FORBID | CacheWriteBehavior.MERGE
    > & {
      context?: DefaultContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TCache>;
      awaitRefetchQueries?: boolean;
      refetchQueries?:
        | ((
            result: NormalizedExecutionResult<Unmasked<TData>>
          ) => InternalRefetchQueriesInclude)
        | InternalRefetchQueriesInclude;
      removeOptimistic?: string;
      onQueryUpdated?: OnQueryUpdated<any>;
      keepRootFields?: boolean;
    },
    cache = this.cache
  ): Promise<
    FormattedExecutionResult<
      DataValue.Complete<TData> | DataValue.Streaming<TData>,
      ExtensionsWithStreamInfo
    >
  > {
    const cacheWrites: Cache.WriteOptions[] = [];
    const skipCache = mutation.cacheWriteBehavior === CacheWriteBehavior.FORBID;

    let result = this.maybeHandleIncrementalResult(
      skipCache ? undefined : (
        cache.diff<TData>({
          id: "ROOT_MUTATION",
          // The cache complains if passed a mutation where it expects a
          // query, so we transform mutations and subscriptions to queries
          // (only once, thanks to this.transformCache).
          query: this.queryManager.getDocumentInfo(mutation.document).asQuery,
          variables: mutation.variables,
          optimistic: false,
          returnPartialData: true,
        }).result
      ),
      incoming,
      mutation.document
    );

    if (mutation.errorPolicy === "ignore") {
      result = { ...result, errors: [] };
    }

    if (graphQLResultHasError(result) && mutation.errorPolicy === "none") {
      return Promise.resolve(result);
    }

    const getResultWithDataState = () =>
      ({
        ...result,
        dataState: this.hasNext ? "streaming" : "complete",
      }) as NormalizedExecutionResult<Unmasked<TData>>;

    if (!skipCache && shouldWriteResult(result, mutation.errorPolicy)) {
      cacheWrites.push({
        result: result.data,
        dataId: "ROOT_MUTATION",
        query: mutation.document,
        variables: mutation.variables,
        extensions: result.extensions,
      });

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
              const nextQueryResult = (updater as MutationQueryReducer<any>)(
                currentQueryResult,
                {
                  mutationResult: getResultWithDataState(),
                  queryName: (document && getOperationName(document)) || void 0,
                  queryVariables: variables!,
                }
              );

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

    let refetchQueries = mutation.refetchQueries;
    if (typeof refetchQueries === "function") {
      refetchQueries = refetchQueries(getResultWithDataState());
    }

    if (
      cacheWrites.length > 0 ||
      (refetchQueries || "").length > 0 ||
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

            // Re-read from the cache after writing to it to update `result`
            // with any parsed scalar values that might have been written.
            if (!skipCache) {
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
                result = {
                  ...result,
                  data: diff.result,
                };
              }
            }

            // If we've received the whole response, call the update function.
            if (update && !this.hasNext) {
              update(
                cache as TCache,
                result as FormattedExecutionResult<Unmasked<TData>>,
                {
                  context: mutation.context,
                  variables: mutation.variables,
                }
              );
            }

            // TODO Do this with cache.evict({ id: 'ROOT_MUTATION' }) but make it
            // shallow to allow rolling back optimistic evictions.
            if (!skipCache && !mutation.keepRootFields && !this.hasNext) {
              cache.modify({
                id: "ROOT_MUTATION",
                fields(value, { fieldName, DELETE }) {
                  return fieldName === "__typename" ? value : DELETE;
                },
              });
            }
          },

          include: refetchQueries,

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

  public markMutationOptimistic(
    optimisticResponse: any,
    mutation: OperationInfo<
      TData,
      TVariables,
      CacheWriteBehavior.FORBID | CacheWriteBehavior.MERGE
    > & {
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
        this.markMutationResult({ data }, mutation, cache as TCache);
      } catch (error) {
        invariant.error(error);
      }
    }, this.id);

    return true;
  }

  public markSubscriptionResult(
    result: FormattedExecutionResult<TData>,
    {
      document,
      variables,
      errorPolicy,
      cacheWriteBehavior,
    }: OperationInfo<
      TData,
      TVariables,
      CacheWriteBehavior.FORBID | CacheWriteBehavior.MERGE
    >
  ) {
    if (cacheWriteBehavior !== CacheWriteBehavior.FORBID) {
      if (shouldWriteResult(result, errorPolicy)) {
        this.cache.write({
          query: document,
          result: result.data as any,
          dataId: "ROOT_SUBSCRIPTION",
          variables: variables,
          extensions: result.extensions,
        });

        // Re-read from the cache to get parsed scalar values
        const diff = this.cache.diff({
          // The cache complains if passed a mutation where it expects a
          // query, so we transform mutations and subscriptions to queries
          // (only once, thanks to this.transformCache).
          query: this.queryManager.getDocumentInfo(document).asQuery,
          id: "ROOT_SUBSCRIPTION",
          variables,
          optimistic: false,
          returnPartialData: true,
        });

        if (diff.complete) {
          result.data = diff.result as any;
        }
      }

      this.queryManager.broadcastQueries();
    }
  }
}

function warnAboutPartialCacheResult(
  query: DocumentNode,
  networkResult: unknown,
  diff: Cache.DiffResult<unknown>
) {
  invariant.warn(
    `The network result for query %s was written to the cache, but reading it back returned a partial result.

A \`read\` or \`merge\` function left missing fields after this write. Because the cache result is incomplete, Apollo Client cannot apply it to the network result. The raw network result was returned instead, and doesn't include any transformed values returned from \`read\` functions or custom scalars.

To address this problem (which is not a bug in Apollo Client), check the \`read\` and \`merge\` functions for the fields in this query. A \`read\` or \`merge\` function that leaves missing fields leaves the cache unable to fulfill the query's data requirements.

  missing fields: %o
  network result: %o
  cache result: %o

For more information, please refer to the documentation:

  * Customizing cache field behavior: https://go.apollo.dev/c/cache-field-behavior
`,
    getOperationName(query, "(anonymous)"),
    diff.missing?.missing,
    networkResult,
    diff.result
  );
}

function shouldWriteResult<T>(
  result: FormattedExecutionResult<T>,
  errorPolicy: ErrorPolicy = "none"
) {
  const ignoreErrors = errorPolicy === "ignore" || errorPolicy === "all";
  let writeWithErrors = !graphQLResultHasError(result);
  if (!writeWithErrors && ignoreErrors && result.data) {
    writeWithErrors = true;
  }
  return writeWithErrors;
}
