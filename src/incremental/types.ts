import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";

import type { FetchResult, GraphQLRequest } from "@apollo/client";
import type { DeepPartial } from "@apollo/client/utilities";

export declare namespace Incremental {
  export type Path = ReadonlyArray<string | number>;

  /** @internal */
  export interface Handler<
    Chunk extends Record<string, unknown> = Record<string, unknown>,
  > {
    isIncrementalResult: (result: FetchResult<any>) => result is Chunk;
    prepareRequest: (request: GraphQLRequest) => GraphQLRequest;
    extractErrors: (
      result: FetchResult<any>
    ) => readonly GraphQLFormattedError[] | undefined | void;
    startRequest: (request: {
      query: DocumentNode;
    }) => IncrementalRequest<Chunk>;
  }

  export interface IncrementalRequest<Chunk extends Record<string, unknown>> {
    hasNext: boolean;
    handle: <TData>(
      cacheData: TData | DeepPartial<TData> | undefined | null,
      chunk: Chunk
    ) => FormattedExecutionResult<TData>;
  }
}
