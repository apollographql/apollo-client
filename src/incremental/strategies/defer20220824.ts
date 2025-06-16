import type { GraphQLFormattedError } from "graphql";
import type { DocumentNode } from "graphql-17-alpha2";

import type { IncrementalPayload } from "@apollo/client";
import {
  DeepMerger,
  hasDirectives,
  isNonEmptyArray,
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

class DeferRequest
  implements Incremental.IncrementalRequest<defer20220824.ExecutionResult>
{
  public hasNext = true;

  constructor(query: DocumentNode) {}
  private errors: Array<GraphQLFormattedError> = [];
  private extensions: Record<string, any> = {};
  private data: any = {};

  handle<TData>(
    // we'll get `undefined` here in case of a `no-cache` fetch policy,
    // so we'll continue with the last value this request had accumulated
    cacheData: TData = this.data,
    chunk: defer20220824.InitialResult | defer20220824.SubsequentResult
  ) {
    this.hasNext = chunk.hasNext;
    this.data = cacheData;
    if ("incremental" in chunk) {
      if (isNonEmptyArray(chunk.incremental)) {
        this.data = mergeIncrementalData(this.data, chunk as any);
        for (const incremental of chunk.incremental) {
          this.errors.push(...(incremental.errors || []));

          Object.assign(this.extensions, incremental.extensions);
        }
      }

      // Detect the first chunk of a deferred query and merge it with existing
      // cache data. This ensures a `cache-first` fetch policy that returns
      // partial cache data or a `cache-and-network` fetch policy that already
      // has full data in the cache does not complain when trying to merge the
      // initial deferred server data with existing cache data.
    } else if ("data" in chunk && chunk.hasNext) {
      this.data = new DeepMerger().merge(this.data, chunk.data);
      this.errors = [...(chunk.errors || [])];
      this.extensions = chunk.extensions || {};
    }

    const { data, errors, extensions } = this;
    return { data, errors, extensions };
  }
}

export function defer20220824(): Incremental.Strategy<defer20220824.ExecutionResult> {
  return {
    isIncrementalResult,
    isIncrementalSubsequentResult,
    isIncrementalInitialResult,
    prepareRequest: (request) => {
      if (hasDirectives(["defer"], request.query)) {
        const context = request.context ?? {};
        const http = (context.http ??= {});
        http.accept = [
          "multipart/mixed;deferSpec=20220824",
          ...(http.accept || []),
        ];
      }

      return request;
    },
    startRequest: ({ query }) => new DeferRequest(query),
  };
}

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

function isIncrementalResult(
  result: Record<string, any>
): result is defer20220824.SubsequentResult | defer20220824.InitialResult {
  return (
    isIncrementalInitialResult(result) || isIncrementalSubsequentResult(result)
  );
}

function mergeIncrementalData<TData extends object>(
  prevResult: TData,
  result:
    | defer20220824.InitialResult<TData>
    | defer20220824.SubsequentResult<TData>
) {
  let mergedData = prevResult;
  const merger = new DeepMerger();
  if (
    isIncrementalSubsequentResult(result) &&
    isNonEmptyArray(result.incremental)
  ) {
    result.incremental.forEach(({ data, path }) => {
      if (!data || !path) return;
      for (let i = path.length - 1; i >= 0; --i) {
        const key = path[i];
        const isNumericKey = !isNaN(+key);
        const parent: Record<string | number, any> = isNumericKey ? [] : {};
        parent[key] = data;
        data = parent as typeof data;
      }
      mergedData = merger.merge(mergedData, data);
    });
  }
  return mergedData as TData;
}
