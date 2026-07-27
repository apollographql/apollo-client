import type { FormattedExecutionResult } from "graphql";

import type { ApolloCache, Cache } from "@apollo/client/cache";
import type { Incremental } from "@apollo/client/incremental";
import type { ApolloLink } from "@apollo/client/link";
import type { Unmasked } from "@apollo/client/masking";
import type { ExtensionsWithStreamInfo } from "@apollo/client/utilities/internal";
import {
  getOperationName,
  graphQLResultHasError,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import type { MutationRequest } from "./MutationRequest.js";
import { IGNORE } from "./MutationRequest.js";
import type { QueryInfo } from "./QueryInfo.js";
import { shouldWriteResult } from "./QueryInfo.js";
import type { QueryManager } from "./QueryManager.js";
import type {
  DataValue,
  MutationQueryReducer,
  NormalizedExecutionResult,
  OperationVariables,
} from "./types.js";

export declare namespace MutationResponse {
  export interface Options<
    TData,
    TVariables extends OperationVariables,
    TCache extends Cache.Implementation,
  > {
    incrementalHandler: Incremental.Handler;
    request: MutationRequest<TData, TVariables, TCache>;
    cache: ApolloCache;
    queryInfo: QueryInfo<TData, TVariables, TCache>;
    queryManager: QueryManager;
  }
}

export class MutationResponse<
  TData,
  TVariables extends OperationVariables,
  TCache extends Cache.Implementation,
> {
  private incrementalHandler: Incremental.Handler;
  private incremental?: Incremental.IncrementalRequest<
    Record<string, unknown>,
    DataValue.Complete<any> | DataValue.Streaming<any>
  >;
  private request: MutationRequest<TData, TVariables, TCache>;
  private cache: ApolloCache;
  private queryInfo: QueryInfo<TData, TVariables, TCache>;
  private queryManager: QueryManager;

  constructor(options: MutationResponse.Options<TData, TVariables, TCache>) {
    this.incrementalHandler = options.incrementalHandler;
    this.request = options.request;
    this.cache = options.cache;
    this.queryInfo = options.queryInfo;
    this.queryManager = options.queryManager;
  }

  get hasNext() {
    return this.incremental?.hasNext ?? false;
  }

  private merge(
    incoming: ApolloLink.Result<TData>
  ): FormattedExecutionResult<
    DataValue.Complete<TData> | DataValue.Streaming<TData>,
    ExtensionsWithStreamInfo
  > {
    const cacheData =
      this.request.fetchPolicy === "no-cache" ?
        undefined
      : this.getDiff().result;

    if (this.incrementalHandler.isIncrementalResult(incoming)) {
      this.incremental ||= this.incrementalHandler.startRequest({
        query: this.request.query,
      });

      return this.incremental.handle(cacheData, incoming);
    }

    return incoming;
  }

  writeOptimistic(data: any) {
    if (data === IGNORE) {
      return false;
    }

    this.cache.recordOptimisticTransaction(() => {
      try {
        this.write({ data });
      } catch (error) {
        invariant.error(error);
      }
    }, this.queryInfo.id);

    return true;
  }

  async write(
    incoming: ApolloLink.Result<TData>,
    { removeOptimistic }: { removeOptimistic?: string } = {}
  ) {
    const { request } = this;
    const skipCache = request.fetchPolicy === "no-cache";

    let result = this.merge(incoming);

    if (request.errorPolicy === "ignore") {
      result = { ...result, errors: [] };
    }

    if (graphQLResultHasError(result) && request.errorPolicy === "none") {
      return Promise.resolve(result);
    }

    const cacheWrites =
      skipCache || !shouldWriteResult(result, request.errorPolicy) ?
        []
      : this.getCacheWrites(result);

    let refetchQueries = request.refetchQueries;
    if (typeof refetchQueries === "function") {
      refetchQueries = refetchQueries(this.getResultWithDataState(result));
    }

    if (
      cacheWrites.length > 0 ||
      (refetchQueries || "").length > 0 ||
      request.update ||
      request.onQueryUpdated ||
      removeOptimistic
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
            const { update } = request;
            // Determine whether result is a SingleExecutionResult,
            // or the final ExecutionPatchResult.

            // Re-read from the cache after writing to it to update `result`
            // with any parsed scalar values that might have been written.
            if (!skipCache) {
              const diff = this.getDiff();

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
                  context: request.context,
                  variables: request.variables,
                }
              );
            }

            // TODO Do this with cache.evict({ id: 'ROOT_MUTATION' }) but make it
            // shallow to allow rolling back optimistic evictions.
            if (!skipCache && !request.keepRootFields && !this.hasNext) {
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
          removeOptimistic,

          // Let the caller of client.mutate optionally determine the refetching
          // behavior for watched queries after the mutation.update function runs.
          // If no onQueryUpdated function was provided for this mutation, pass
          // null instead of undefined to disable the default refetching behavior.
          onQueryUpdated: request.onQueryUpdated || null,
        })
        .forEach((result) => results.push(result));

      if (request.awaitRefetchQueries || request.onQueryUpdated) {
        // Returning a promise here makes the mutation await that promise, so we
        // include results in that promise's work if awaitRefetchQueries or an
        // onQueryUpdated function was specified.
        return Promise.all(results).then(() => result);
      }
    }

    return Promise.resolve(result);
  }

  private getCacheWrites(result: FormattedExecutionResult<TData>) {
    const { request } = this;
    const cacheWrites: Cache.WriteOptions[] = [];

    cacheWrites.push({
      result: result.data,
      dataId: "ROOT_MUTATION",
      query: request.mutation,
      variables: request.variables,
      extensions: result.extensions,
    });

    const { updateQueries } = request;
    if (updateQueries) {
      this.queryManager
        .getObservableQueries("all")
        .forEach((observableQuery) => {
          const queryName = observableQuery.queryName;
          if (!queryName || !Object.hasOwn(updateQueries, queryName)) {
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
                mutationResult: this.getResultWithDataState(result),
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

    return cacheWrites;
  }

  private getResultWithDataState(result: FormattedExecutionResult<TData>) {
    return {
      ...result,
      dataState: this.hasNext ? "streaming" : "complete",
    } as NormalizedExecutionResult<Unmasked<TData>>;
  }

  private getDiff() {
    return this.cache.diff<TData>({
      id: "ROOT_MUTATION",
      // The cache complains if passed a mutation where it expects a
      // query, so we transform mutations and subscriptions to queries
      // (only once, thanks to this.transformCache).
      query: this.queryManager.getDocumentInfo(this.request.mutation).asQuery,
      variables: this.request.variables,
      optimistic: false,
      returnPartialData: true,
    });
  }
}
