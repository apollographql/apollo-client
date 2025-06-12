import type { GraphQLFormattedError } from "graphql";

import { IncrementalPayload } from "@apollo/client";
import {
  DeepMerger,
  isNonEmptyArray,
  mergeIncrementalData,
} from "@apollo/client/utilities/internal";

import type { Incremental } from "../types.js";

export declare namespace defer20220824 {
  export interface InitialResult<TData = Record<string, unknown>> {
    data: TData | null | undefined;
    errors?: ReadonlyArray<GraphQLFormattedError>;
    extensions?: Record<string, any>;
    hasNext: boolean;
  }

  export interface SubsequentResult<TData = Record<string, unknown>> {
    hasNext: boolean;
    incremental?: Array<IncrementalPayload<TData>>;
  }

  export interface ExecutionResult<TData = Record<string, unknown>> {
    Initial: InitialResult<TData>;
    Subsequent: SubsequentResult<TData>;
  }

  export type IncrementalPayload<TData = Record<string, unknown>> =
    IncrementalDeferPayload<TData>;

  export interface IncrementalDeferPayload<TData = Record<string, unknown>> {
    data?: TData | null;
    errors?: ReadonlyArray<GraphQLFormattedError>;
    extensions?: Record<string, unknown>;
    path?: Incremental.Path;
    label?: string;
  }
}

type Chunk = defer20220824.InitialResult | defer20220824.SubsequentResult;

class DeferRequest
  implements Incremental.IncrementalRequest<defer20220824.ExecutionResult>
{
  public hasNext = true;
  private chunks: Array<Chunk> = [];

  append(chunk: Chunk) {
    this.hasNext = chunk.hasNext;
    this.chunks.push(chunk);
  }

  apply<TData>(
    data: TData,
    chunk: defer20220824.InitialResult | defer20220824.SubsequentResult
  ) {
    if ("incremental" in chunk) {
      return isNonEmptyArray(chunk.incremental) ?
          mergeIncrementalData(data as any, chunk as any)
        : data;

      // Detect the first chunk of a deferred query and merge it with existing
      // cache data. This ensures a `cache-first` fetch policy that returns
      // partial cache data or a `cache-and-network` fetch policy that already
      // has full data in the cache does not complain when trying to merge the
      // initial deferred server data with existing cache data.
    } else if ("data" in chunk && chunk.hasNext) {
      return new DeepMerger().merge(data, chunk.data);
    }

    return data;
  }

  // TODO when we are ready to implement this.
  getPending() {
    return [];
  }
}

export function defer20220824(): Incremental.Strategy<defer20220824.ExecutionResult> {
  return {
    isIncrementalPatchResult: (
      result: Record<string, any>
    ): result is defer20220824.ExecutionResult => "hasNext" in result,
    prepareRequest: (request) => request,
    startRequest: () => new DeferRequest(),
  };
}
