import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";

import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial, HKT } from "@apollo/client/utilities";
import {
  hasDirectives,
  isNonEmptyArray,
} from "@apollo/client/utilities/internal";

import type { Incremental } from "../types.js";

export declare namespace GraphQL17Alpha9Handler {
  interface GraphQL17Alpha9Result extends HKT {
    arg1: unknown; // TData
    arg2: unknown; // TExtensions
    return: GraphQL17Alpha9Handler.Chunk<Record<string, unknown>>;
  }

  export interface TypeOverrides {
    AdditionalApolloLinkResultTypes: GraphQL17Alpha9Result;
  }

  export type InitialResult<TData = Record<string, unknown>> = {
    data: TData;
    pending: ReadonlyArray<PendingResult>;
    hasNext: boolean;
    extensions?: Record<string, unknown>;
  };

  export type SubsequentResult<TData = Record<string, unknown>> = {
    hasNext: boolean;
    pending?: ReadonlyArray<PendingResult>;
    incremental?: ReadonlyArray<IncrementalResult<TData>>;
    completed?: ReadonlyArray<CompletedResult>;
    extensions?: Record<string, unknown>;
  };

  export interface PendingResult {
    id: string;
    path: Incremental.Path;
    label?: string;
  }

  export interface CompletedResult {
    path: Incremental.Path;
    label?: string;
    errors?: ReadonlyArray<GraphQLFormattedError>;
  }

  export interface IncrementalDeferResult<TData = Record<string, unknown>> {
    errors?: ReadonlyArray<GraphQLFormattedError>;
    data: TData;
    id: string;
    subPath?: ReadonlyArray<string | number>;
    extensions?: Record<string, unknown>;
  }

  export interface IncrementalStreamResult<TData = ReadonlyArray<unknown>> {
    errors?: ReadonlyArray<GraphQLFormattedError>;
    items: TData;
    id: string;
    subPath?: ReadonlyArray<string | number>;
    extensions?: Record<string, unknown>;
  }

  export type IncrementalResult<TData = Record<string, unknown>> =
    | IncrementalDeferResult<TData>
    | IncrementalStreamResult<TData>;

  export type Chunk<TData extends Record<string, unknown>> =
    | InitialResult<TData>
    | SubsequentResult<TData>;
}

class IncrementalRequest<TData extends Record<string, unknown>>
  implements
    Incremental.IncrementalRequest<GraphQL17Alpha9Handler.Chunk<TData>, TData>
{
  hasNext = true;

  private data: any = {};

  handle(
    cacheData: TData | DeepPartial<TData> | null | undefined = this.data,
    chunk: GraphQL17Alpha9Handler.Chunk<TData>
  ): FormattedExecutionResult<TData> {
    return { data: null };
  }
}

export class GraphQL17Alpha9Handler<TData extends Record<string, unknown>>
  implements Incremental.Handler<GraphQL17Alpha9Handler.Chunk<any>>
{
  isIncrementalResult(
    result: ApolloLink.Result<any>
  ): result is GraphQL17Alpha9Handler.Chunk<TData> {
    return "hasNext" in result;
  }

  prepareRequest(request: ApolloLink.Request): ApolloLink.Request {
    if (hasDirectives(["defer"], request.query)) {
      const context = request.context ?? {};
      const http = (context.http ??= {});
      http.accept = ["multipart/mixed", ...(http.accept || [])];

      request.context = context;
    }

    return request;
  }

  extractErrors(result: ApolloLink.Result<any>) {}

  startRequest<TData extends Record<string, unknown>>(_: {
    query: DocumentNode;
  }) {
    return new IncrementalRequest<TData>();
  }
}

// only exported for use in tests
export function hasIncrementalChunks(
  result: Record<string, any>
): result is Required<GraphQL17Alpha9Handler.SubsequentResult> {
  return isNonEmptyArray(result.incremental);
}
