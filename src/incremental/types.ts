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
    /** @internal */
    isIncrementalResult: (result: ApolloLink.Result<any>) => result is Chunk;

    /** @internal */
    prepareRequest: (request: ApolloLink.Request) => ApolloLink.Request;

    /** @internal */
    extractErrors: (
      result: ApolloLink.Result<any>
    ) => readonly GraphQLFormattedError[] | undefined | void;

    /** @internal */
    startRequest: <TData extends Record<string, unknown>>(request: {
      query: DocumentNode;
    }) => IncrementalRequest<Chunk, TData>;
  }

  export interface IncrementalRequest<
    Chunk extends Record<string, unknown>,
    TData,
  > {
    /** @internal */
    hasNext: boolean;

    /** @internal */
    handle: (
      chunk: Chunk,
      cacheData: TData | DeepPartial<TData> | undefined | null
    ) => FormattedExecutionResult<TData>;
  }
}
