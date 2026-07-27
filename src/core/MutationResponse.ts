import type { FormattedExecutionResult } from "graphql";

import type { Cache } from "@apollo/client/cache";
import type { Incremental } from "@apollo/client/incremental";
import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial } from "@apollo/client/utilities";
import type { ExtensionsWithStreamInfo } from "@apollo/client/utilities/internal";

import type { MutationRequest } from "./MutationRequest.js";
import type { DataValue, OperationVariables } from "./types.js";

export declare namespace MutationResponse {
  export interface Options<
    TData,
    TVariables extends OperationVariables,
    TCache extends Cache.Implementation,
  > {
    incrementalHandler: Incremental.Handler;
    request: MutationRequest<TData, TVariables, TCache>;
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

  constructor(options: MutationResponse.Options<TData, TVariables, TCache>) {
    this.incrementalHandler = options.incrementalHandler;
    this.request = options.request;
  }

  get hasNext() {
    return this.incremental?.hasNext ?? false;
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
