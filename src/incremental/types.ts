import type { GraphQLRequest } from "@apollo/client";

export declare namespace Incremental {
  export interface ExecutionResult {
    Initial: unknown;
    Subsequent: unknown;
  }

  export type Path = Array<string | number>;

  export interface Pending {
    id: string;
    path: Path;
    label?: string;
  }

  export interface Strategy<
    TExecutionResult extends Incremental.ExecutionResult,
  > {
    isIncrementalPatchResult: (result: unknown) => result is TExecutionResult;
    prepareRequest: (request: GraphQLRequest) => GraphQLRequest;
    startRequest: () => IncrementalRequest<TExecutionResult>;
  }

  export interface IncrementalRequest<
    TExecutionResult extends Incremental.ExecutionResult,
    Chunk = TExecutionResult["Initial"] | TExecutionResult["Subsequent"],
  > {
    hasNext: boolean;
    append: (chunk: Chunk) => this;
    apply: <TData>(data: TData, chunk: Chunk) => TData;

    // reservered for future
    getPending: () => Pending[];
  }
}
