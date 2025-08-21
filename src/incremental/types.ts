import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";

import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial } from "@apollo/client/utilities";

export declare namespace Incremental {
  export type Path = ReadonlyArray<string | number>;

  /** @internal */
  export interface Handler<
    Chunk extends Record<string, unknown> = Record<string, unknown>,
  > {
    isIncrementalResult: (result: ApolloLink.Result<any>) => result is Chunk;
    prepareRequest: (request: ApolloLink.Request) => ApolloLink.Request;
    extractErrors: (
      result: ApolloLink.Result<any>
    ) => readonly GraphQLFormattedError[] | undefined | void;
    startRequest: <TData extends Record<string, unknown>>(request: {
      query: DocumentNode;
    }) => IncrementalRequest<Chunk, TData>;
  }

  export interface IncrementalRequest<
    Chunk extends Record<string, unknown>,
    TData,
  > {
    hasNext: boolean;
    handle: (
      cacheData: TData | DeepPartial<TData> | undefined | null,
      chunk: Chunk
    ) => FormattedExecutionResult<TData>;
  }
}
