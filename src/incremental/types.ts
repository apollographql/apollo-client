import type { DocumentNode } from "graphql-17-alpha2";

import type { GraphQLRequest } from "@apollo/client";

export declare namespace Incremental {
  export interface ExecutionResult {
    Initial: any;
    Subsequent: any;
  }

  export type Path = ReadonlyArray<string | number>;

  export interface Pending {
    id: string;
    path: Path;
    label?: string;
  }

  export interface Strategy<
    TExecutionResult extends
      Incremental.ExecutionResult = Incremental.ExecutionResult,
  > {
    isIncrementalPatchResult: (
      result: Record<string, any>
    ) => result is TExecutionResult;
    prepareRequest: (request: GraphQLRequest) => GraphQLRequest;
    startRequest: (request: {
      query: DocumentNode;
    }) => IncrementalRequest<TExecutionResult>;
  }

  export interface IncrementalRequest<
    TExecutionResult extends Incremental.ExecutionResult,
    Chunk = TExecutionResult["Initial"] | TExecutionResult["Subsequent"],
  > {
    hasNext: boolean;
    append: (chunk: Chunk) => void;
    apply: <TData>(data: TData, chunk: Chunk) => TData;

    // reservered for future
    getPending: () => Pending[];
  }
}
