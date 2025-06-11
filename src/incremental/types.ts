import type { GraphQLRequest } from "@apollo/client";

export declare namespace Incremental {
  export interface InitialChunk {}
  export interface IncrementalChunk {}

  export type Chunk = InitialChunk | IncrementalChunk;
  export type Path = Array<string | number>;

  export interface Pending {
    id: string;
    path: Path;
    label?: string;
  }

  export interface Strategy {
    prepareRequest: (request: GraphQLRequest) => GraphQLRequest;
    startRequest: () => IncrementalRequest;
  }

  export interface IncrementalRequest {
    hasNext: boolean;
    append: (chunk: Chunk) => this;
    apply: <TData>(data: TData, chunk: Chunk) => TData;

    // reservered for future
    getPending: () => Pending[];
  }
}
