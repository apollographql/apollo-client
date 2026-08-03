import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";

import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial } from "@apollo/client/utilities";
import type { StreamInfoTrie } from "@apollo/client/utilities/internal";

export declare namespace Incremental {
  export type Path = ReadonlyArray<string | number>;

  export interface PendingResult {
    id: string;
    path: Incremental.Path;
    label?: string;
  }

  /** @internal */
  export interface Handler<
    Chunk extends Record<string, unknown> = Record<string, unknown>,
  > {
    isIncrementalResult: (result: ApolloLink.Result<any>) => result is Chunk;
    prepareRequest: (request: ApolloLink.Request) => ApolloLink.Request;
    extractErrors: (
      result: ApolloLink.Result<any>
    ) => readonly GraphQLFormattedError[] | undefined | void;
    startRequest: <TData extends Record<string, unknown>>(
      request: Incremental.StartRequestOptions
    ) => IncrementalRequest<Chunk, TData>;
  }

  /** @internal */
  export interface StartRequestOptions {
    query: DocumentNode;
  }

  export interface IncrementalRequest<
    Chunk extends Record<string, unknown>,
    TData,
  > {
    hasNext: boolean;
    readonly streamInfo?: StreamInfoTrie;
    getPendingWithInfo?: () => Array<PendingItemWithInfo>;
    handle: (
      cacheData: TData | DeepPartial<TData> | undefined | null,
      chunk: Chunk
    ) => FormattedExecutionResult<TData>;
  }

  /** @internal */
  export interface PendingDeferResultWithInfo {
    type: "defer";
    delivered: boolean;
    path: Incremental.Path;
  }

  /** @internal */
  export interface PendingStreamResultWithInfo {
    type: "stream";
    path: Incremental.Path;
  }

  /* @internal */
  export type PendingItemWithInfo =
    | PendingDeferResultWithInfo
    | PendingStreamResultWithInfo;

  /** @internal */
  export interface StreamFieldInfo {
    isFirstChunk: boolean;
    isLastChunk: boolean;
  }
}
