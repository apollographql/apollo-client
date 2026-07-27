import type { FormattedExecutionResult } from "graphql";

import type { Incremental } from "@apollo/client/incremental";
import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial } from "@apollo/client/utilities";
import type { ExtensionsWithStreamInfo } from "@apollo/client/utilities/internal";

import type { DataValue, GraphQLRequest } from "./types.js";

export declare namespace GraphQLResponse {
  export interface Options {
    incrementalHandler: Incremental.Handler;
    request: GraphQLRequest;
  }
}

export class GraphQLResponse<TData> {
  private incrementalHandler: Incremental.Handler;
  private incremental: Incremental.IncrementalRequest<
    Record<string, unknown>,
    DataValue.Complete<any> | DataValue.Streaming<any>
  >;

  constructor(options: GraphQLResponse.Options) {
    const { incrementalHandler, request } = options;

    this.incrementalHandler = incrementalHandler;
    this.incremental = incrementalHandler.startRequest({
      query: request.query,
    });
  }

  merge(
    cacheData: TData | DeepPartial<TData> | undefined | null,
    incoming: ApolloLink.Result<TData>
  ): FormattedExecutionResult<
    DataValue.Complete<TData> | DataValue.Streaming<TData>,
    ExtensionsWithStreamInfo
  > {
    if (this.incrementalHandler.isIncrementalResult(incoming)) {
      return this.incremental.handle(cacheData, incoming);
    }

    return incoming;
  }
}
