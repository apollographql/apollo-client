import type { GraphQLRequest } from "@apollo/client";

export declare namespace Incremental {
  export interface InitialChunk {}
  export interface IncrementalChunk {}

  export type Chunk = InitialChunk | IncrementalChunk;
  export type Path = Array<string | number>;

  export interface Strategy {
    prepareRequest: (request: GraphQLRequest) => GraphQLRequest;
    startRequest: <TData>(initialData: TData) => IncrementalRequest;
  }

  export interface IncrementalRequest {
    append: (chunk: Chunk) => void;
  }
}
