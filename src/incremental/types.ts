import type { DocumentNode, FormattedExecutionResult } from "graphql";

import type { GraphQLRequest } from "@apollo/client";

export declare namespace Incremental {
  export type Path = ReadonlyArray<string | number>;

  /** @internal */
  export interface Handler<
    Chunk extends Record<string, unknown> = Record<string, unknown>,
  > {
    isIncrementalResult: (result: Record<string, any>) => result is Chunk;
    prepareRequest: (request: GraphQLRequest) => GraphQLRequest;
    startRequest: (request: {
      query: DocumentNode;
    }) => IncrementalRequest<Chunk>;
  }

  export interface IncrementalRequest<Chunk extends Record<string, unknown>> {
    hasNext: boolean;
    handle: <TData>(
      cacheData: TData | undefined | null,
      chunk: Chunk
    ) => FormattedExecutionResult<TData>;
  }
}
