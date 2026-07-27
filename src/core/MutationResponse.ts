import type { FormattedExecutionResult } from "graphql";
import type { DocumentNode } from "graphql";

import type { ApolloCache, Cache } from "@apollo/client/cache";
import type { Incremental } from "@apollo/client/incremental";
import type { ApolloLink } from "@apollo/client/link";
import type { ExtensionsWithStreamInfo } from "@apollo/client/utilities/internal";

import type { MutationRequest } from "./MutationRequest.js";
import { CacheWriteBehavior } from "./QueryInfo.js";
import type { TransformCacheEntry } from "./QueryManager.js";
import type { DataValue, OperationVariables } from "./types.js";

export declare namespace MutationResponse {
  export interface Options<
    TData,
    TVariables extends OperationVariables,
    TCache extends Cache.Implementation,
  > {
    incrementalHandler: Incremental.Handler;
    request: MutationRequest<TData, TVariables, TCache>;
    cache: ApolloCache;
    getDocumentInfo: (mutation: DocumentNode) => TransformCacheEntry;
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
  private getDocumentInfo: (mutation: DocumentNode) => TransformCacheEntry;

  constructor(options: MutationResponse.Options<TData, TVariables, TCache>) {
    this.incrementalHandler = options.incrementalHandler;
    this.request = options.request;
    this.cache = options.cache;
    this.getDocumentInfo = options.getDocumentInfo;
  }

  get hasNext() {
    return this.incremental?.hasNext ?? false;
  }

  merge(
    incoming: ApolloLink.Result<TData>
  ): FormattedExecutionResult<
    DataValue.Complete<TData> | DataValue.Streaming<TData>,
    ExtensionsWithStreamInfo
  > {
    const skipCache =
      this.request.cacheWriteBehavior === CacheWriteBehavior.FORBID;

    const cacheData =
      skipCache ? undefined : (
        this.cache.diff<TData>({
          id: "ROOT_MUTATION",
          // The cache complains if passed a mutation where it expects a
          // query, so we transform mutations and subscriptions to queries
          // (only once, thanks to this.transformCache).
          query: this.getDocumentInfo(this.request.mutation).asQuery,
          variables: this.request.variables,
          optimistic: false,
          returnPartialData: true,
        }).result
      );

    if (this.incrementalHandler.isIncrementalResult(incoming)) {
      this.incremental ||= this.incrementalHandler.startRequest({
        query: this.request.query,
      });

      return this.incremental.handle(cacheData, incoming);
    }

    return incoming;
  }
}
