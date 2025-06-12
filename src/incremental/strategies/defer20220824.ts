import type { GraphQLFormattedError } from "graphql";
import type { DocumentNode } from "graphql-17-alpha2";

import { IncrementalPayload } from "@apollo/client";
import {
  DeepMerger,
  hasDirectives,
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
  private pending: Incremental.Pending[];

  constructor(query: DocumentNode, initialChunk: defer20220824.InitialResult) {
    // You can imagine this would traverse the query and pull out the `@defer`
    // locations since we don't get this in the response info
    this.pending = [];
  }

  apply<TData>(
    data: TData,
    chunk: defer20220824.InitialResult | defer20220824.SubsequentResult
  ) {
    this.hasNext = chunk.hasNext;
    // TODO evaluate `this.pending` since this chunk might complete one of the
    // `@defer` paths

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
    return this.pending;
  }
}

export function defer20220824(): Incremental.Strategy<defer20220824.ExecutionResult> {
  function isIncrementalSubsequentResult(
    result: Record<string, any>
  ): result is defer20220824.SubsequentResult {
    return "incremental" in result;
  }

  function isIncrementalInitialResult(
    result: Record<string, any>
  ): result is defer20220824.InitialResult {
    return "hasNext" in result && "data" in result;
  }

  return {
    isIncrementalResult: (
      result: Record<string, any>
    ): result is defer20220824.SubsequentResult | defer20220824.InitialResult =>
      isIncrementalInitialResult(result) ||
      isIncrementalSubsequentResult(result),
    isIncrementalSubsequentResult,
    isIncrementalInitialResult,
    prepareRequest: (request) => {
      if (hasDirectives(["defer"], request.query)) {
        const context = request.context ?? {};
        const http = (context.http ??= {});
        http.accept = [
          "multipart/mixed;deferSpec=20220824;q=1.1",
          ...(http.accept || []),
        ];
      }

      return request;
    },
    startRequest: ({ query, initialChunk }) =>
      new DeferRequest(query, initialChunk),
  };
}
