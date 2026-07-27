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
      : this.cache.diff<TData>({
          id: "ROOT_MUTATION",
          // The cache complains if passed a mutation where it expects a
          // query, so we transform mutations and subscriptions to queries
          // (only once, thanks to this.transformCache).
          query: this.queryManager.getDocumentInfo(this.request.mutation)
            .asQuery,
          variables: this.request.variables,
          optimistic: false,
          returnPartialData: true,
        }).result;

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

  write(
    incoming: ApolloLink.Result<TData>,
    { removeOptimistic }: { removeOptimistic?: string } = {}
  ) {
    const { request } = this;
    const cacheWrites: Cache.WriteOptions[] = [];
    const skipCache = request.fetchPolicy === "no-cache";

    let result = this.merge(incoming);

    if (request.errorPolicy === "ignore") {
      result = { ...result, errors: [] };
    }

    if (graphQLResultHasError(result) && request.errorPolicy === "none") {
      return Promise.resolve(result);
    }

    const getResultWithDataState = () =>
      ({
        ...result,
        dataState: this.hasNext ? "streaming" : "complete",
      }) as NormalizedExecutionResult<Unmasked<TData>>;

    if (!skipCache && shouldWriteResult(result, request.errorPolicy)) {
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

    let refetchQueries = request.refetchQueries;
    if (typeof refetchQueries === "function") {
      refetchQueries = refetchQueries(getResultWithDataState());
    }

    return this.queryInfo.markMutationResult(this.request, this, result, {
      refetchQueries,
      cacheWrites,
      removeOptimistic,
    });
  }
}
