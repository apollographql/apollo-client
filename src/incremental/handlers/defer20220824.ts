import type { DocumentNode, GraphQLFormattedError } from "graphql";

import type { GraphQLRequest, IncrementalPayload } from "@apollo/client";
import {
  DeepMerger,
  getGraphQLErrorsFromResult,
  hasDirectives,
  isNonEmptyArray,
} from "@apollo/client/utilities/internal";

import type { Incremental } from "../types.js";

export declare namespace Defer20220824Handler {
  export type InitialResult<TData = Record<string, unknown>> = {
    data: TData | null | undefined;
    errors?: ReadonlyArray<GraphQLFormattedError>;
    extensions?: Record<string, any>;
    hasNext: boolean;
  };

  export type SubsequentResult<TData = Record<string, unknown>> = {
    hasNext: boolean;
    incremental?: Array<IncrementalPayload<TData>>;
  };

  export type Chunk<TData = Record<string, unknown>> =
    | InitialResult<TData>
    | SubsequentResult<TData>;

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

declare module "@apollo/client/link" {
  export interface AdditionalFetchResultTypes {
    Defer20220824Handler: Defer20220824Handler.Chunk;
  }
}

class DeferRequest
  implements Incremental.IncrementalRequest<Defer20220824Handler.Chunk>
{
  public hasNext = true;

  constructor(private strategy: Defer20220824Handler) {}
  private errors: Array<GraphQLFormattedError> = [];
  private extensions: Record<string, any> = {};
  private data: any = {};

  handle<TData>(
    // we'll get `undefined` here in case of a `no-cache` fetch policy,
    // so we'll continue with the last value this request had accumulated
    cacheData: TData = this.data,
    chunk:
      | Defer20220824Handler.InitialResult
      | Defer20220824Handler.SubsequentResult
  ) {
    this.hasNext = chunk.hasNext;
    this.data = cacheData;
    if (this.strategy.isIncrementalSubsequentResult(chunk)) {
      if (isNonEmptyArray(chunk.incremental)) {
        const merger = new DeepMerger();
        for (const incremental of chunk.incremental) {
          let { data, path } = incremental;
          if (data && path) {
            for (let i = path.length - 1; i >= 0; --i) {
              const key = path[i];
              const isNumericKey = !isNaN(+key);
              const parent: Record<string | number, any> =
                isNumericKey ? [] : {};
              parent[key] = data;
              data = parent as typeof data;
            }
            this.data = merger.merge(this.data, data);
          }
          this.errors.push(...getGraphQLErrorsFromResult(incremental));
          Object.assign(this.extensions, incremental.extensions);
        }
      }

      // Detect the first chunk of a deferred query and merge it with existing
      // cache data. This ensures a `cache-first` fetch policy that returns
      // partial cache data or a `cache-and-network` fetch policy that already
      // has full data in the cache does not complain when trying to merge the
      // initial deferred server data with existing cache data.
    } else if (this.strategy.isIncrementalResult(chunk)) {
      this.data = new DeepMerger().merge(this.data, chunk.data);
      this.errors = getGraphQLErrorsFromResult(chunk);
      this.extensions = { ...chunk.extensions };
    }

    const { data, errors, extensions } = this;
    return { data, errors, extensions };
  }
}

export class Defer20220824Handler
  implements Incremental.Handler<Defer20220824Handler.Chunk>
{
  isIncrementalSubsequentResult(
    result: Record<string, any>
  ): result is Defer20220824Handler.SubsequentResult {
    return "incremental" in result;
  }

  isIncrementalInitialResult(
    result: Record<string, any>
  ): result is Defer20220824Handler.InitialResult {
    return "hasNext" in result && "data" in result;
  }

  isIncrementalResult(
    result: Record<string, any>
  ): result is
    | Defer20220824Handler.SubsequentResult
    | Defer20220824Handler.InitialResult {
    return (
      this.isIncrementalInitialResult(result) ||
      this.isIncrementalSubsequentResult(result)
    );
  }

  prepareRequest(request: GraphQLRequest): GraphQLRequest {
    if (hasDirectives(["defer"], request.query)) {
      const context = request.context ?? {};
      const http = (context.http ??= {});
      http.accept = [
        "multipart/mixed;deferSpec=20220824",
        ...(http.accept || []),
      ];
    }

    return request;
  }
  startRequest(_: { query: DocumentNode }) {
    return new DeferRequest(this);
  }
}
