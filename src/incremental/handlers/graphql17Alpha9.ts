import type { DocumentNode, GraphQLFormattedError } from "graphql";

import type { ApolloLink } from "@apollo/client";
import type { HKT } from "@apollo/client/utilities";
import { isNonEmptyArray } from "@apollo/client/utilities/internal";

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

  export type InitialResult<TData = Record<string, unknown>> = {};
  export type SubsequentResult<TData = Record<string, unknown>> = {};

  export type Chunk<TData extends Record<string, unknown>> =
    | InitialResult<TData>
    | SubsequentResult<TData>;
}

export class GraphQL17Alpha9Handler<TData extends Record<string, unknown>>
  implements Incremental.Handler<GraphQL17Alpha9Handler.Chunk<TData>>
{
  isIncrementalResult: (
    result: ApolloLink.Result<any>
  ) => result is GraphQL17Alpha9Handler.Chunk<TData>;

  prepareRequest: (request: ApolloLink.Request) => ApolloLink.Request;

  extractErrors: (
    result: ApolloLink.Result<any>
  ) => readonly GraphQLFormattedError[] | undefined | void;

  startRequest: <TData extends Record<string, unknown>>(request: {
    query: DocumentNode;
  }) => Incremental.IncrementalRequest<
    GraphQL17Alpha9Handler.Chunk<TData>,
    TData
  >;
}

// only exported for use in tests
export function hasIncrementalChunks(
  result: Record<string, any>
): result is Required<GraphQL17Alpha9Handler.SubsequentResult> {
  return isNonEmptyArray(result.incremental);
}
