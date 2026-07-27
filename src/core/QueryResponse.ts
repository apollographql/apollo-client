import type { FormattedExecutionResult } from "graphql";

import type { Incremental } from "@apollo/client/incremental";
import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial } from "@apollo/client/utilities";
import type { ExtensionsWithStreamInfo } from "@apollo/client/utilities/internal";

import type { QueryRequest } from "./QueryRequest.js";
import type { DataValue, OperationVariables } from "./types.js";

export declare namespace QueryResponse {
  export interface Options<TData, TVariables extends OperationVariables> {
    incrementalHandler: Incremental.Handler;
    request: QueryRequest<TData, TVariables>;
  }
}

export class QueryResponse<TData, TVariables extends OperationVariables> {
  private incrementalHandler: Incremental.Handler;
  private incremental?: Incremental.IncrementalRequest<
    Record<string, unknown>,
    DataValue.Complete<any> | DataValue.Streaming<any>
  >;
  private request: QueryRequest<TData, TVariables>;

  constructor(options: QueryResponse.Options<TData, TVariables>) {
    this.incrementalHandler = options.incrementalHandler;
    this.request = options.request;
  }

  get hasNext() {
    return this.incremental?.hasNext ?? false;
  }

  get pending() {
    return this.incremental?.pending;
  }

  getPendingType(id: string) {
    return this.incremental?.getPendingType?.(id);
  }

  merge(
    cacheData: TData | DeepPartial<TData> | undefined | null,
    incoming: ApolloLink.Result<TData>
  ): FormattedExecutionResult<
    DataValue.Complete<TData> | DataValue.Streaming<TData>,
    ExtensionsWithStreamInfo
  > {
    if (this.incrementalHandler.isIncrementalResult(incoming)) {
      this.incremental ||= this.incrementalHandler.startRequest({
        query: this.request.query,
      });

      return this.incremental.handle(cacheData, incoming);
    }

    return incoming;
  }
}
