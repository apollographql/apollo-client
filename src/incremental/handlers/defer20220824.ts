import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";

import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial, HKT } from "@apollo/client/utilities";
import {
  DeepMerger,
  hasDirectives,
  isNonEmptyArray,
} from "@apollo/client/utilities/internal";

import type { Incremental } from "../types.js";

export declare namespace Defer20220824Handler {
  interface Defer20220824Result extends HKT {
    arg1: unknown; // TData
    arg2: unknown; // TExtensions
    return: Defer20220824Handler.Chunk<Record<string, unknown>>;
  }
  export interface TypeOverrides {
    AdditionalApolloLinkResultTypes: Defer20220824Result;
  }

  export type InitialResult<TData = Record<string, unknown>> = {
    data?: TData | null | undefined;
    errors?: ReadonlyArray<GraphQLFormattedError>;
    extensions?: Record<string, unknown>;
    hasNext: boolean;
    incremental?: ReadonlyArray<IncrementalResult<TData>>;
  };

  export type SubsequentResult<TData = Record<string, unknown>> = {
    data?: TData | null | undefined;
    errors?: ReadonlyArray<GraphQLFormattedError>;
    extensions?: Record<string, unknown>;
    hasNext: boolean;
    incremental?: Array<IncrementalResult<TData>>;
  };

  export type IncrementalDeferResult<TData = Record<string, unknown>> = {
    data?: TData | null;
    errors?: ReadonlyArray<GraphQLFormattedError>;
    extensions?: Record<string, unknown>;
    path?: Incremental.Path;
    label?: string;
  };

  export type IncrementalStreamResult<TData = Array<unknown>> = {
    errors?: ReadonlyArray<GraphQLFormattedError>;
    items?: TData;
    path?: Incremental.Path;
    label?: string;
    extensions?: Record<string, unknown>;
  };

  export type IncrementalResult<TData = Record<string, unknown>> =
    | IncrementalDeferResult<TData>
    | IncrementalStreamResult<TData>;

  export type Chunk<TData extends Record<string, unknown>> =
    | InitialResult<TData>
    | SubsequentResult<TData>;
}

class DeferRequest<TData extends Record<string, unknown>>
  implements
    Incremental.IncrementalRequest<Defer20220824Handler.Chunk<TData>, TData>
{
  public hasNext = true;

  private errors: Array<GraphQLFormattedError> = [];
  private extensions: Record<string, any> = {};
  private data: any = {};

  private merge(
    normalized: FormattedExecutionResult<TData>,
    arrayMerge: DeepMerger.ArrayMergeStrategy = "truncate"
  ) {
    if (normalized.data !== undefined) {
      this.data = new DeepMerger(undefined, { arrayMerge }).merge(
        this.data,
        normalized.data
      );
    }
    if (normalized.errors) {
      this.errors.push(...normalized.errors);
    }
    Object.assign(this.extensions, normalized.extensions);
  }

  handle(
    // we'll get `undefined` here in case of a `no-cache` fetch policy,
    // so we'll continue with the last value this request had accumulated
    chunk: Defer20220824Handler.Chunk<TData>,
    cacheData: TData | DeepPartial<TData> | null | undefined = this.data
  ): FormattedExecutionResult<TData> {
    this.hasNext = chunk.hasNext;
    this.data = cacheData;
    this.merge(chunk);

    if (hasIncrementalChunks(chunk)) {
      for (const incremental of chunk.incremental) {
        const { path, errors, extensions } = incremental;
        let arrayMerge: DeepMerger.ArrayMergeStrategy = "truncate";
        let data =
          // The item merged from a `@stream` chunk is always the first item in
          // the `items` array
          "items" in incremental ? incremental.items?.[0]
            // Ensure `data: null` isn't merged for `@defer` responses by
            // falling back to `undefined`
          : "data" in incremental ? incremental.data ?? undefined
          : undefined;

        if (data !== undefined && path) {
          for (let i = path.length - 1; i >= 0; --i) {
            const key = path[i];
            const isNumericKey = !isNaN(+key);
            const parent: Record<string | number, any> = isNumericKey ? [] : {};
            if (isNumericKey) {
              arrayMerge = "combine";
            }
            parent[key] = data;
            data = parent as typeof data;
          }
        }
        this.merge(
          {
            errors,
            extensions,
            data: data ? (data as TData) : undefined,
          },
          arrayMerge
        );
      }
    }

    const result: FormattedExecutionResult<TData> = { data: this.data };

    if (isNonEmptyArray(this.errors)) {
      result.errors = this.errors;
    }

    if (Object.keys(this.extensions).length > 0) {
      result.extensions = this.extensions;
    }

    return result;
  }
}

/**
 * This handler implements the `@defer` directive as specified in this historical commit:
 * https://github.com/graphql/graphql-spec/tree/48cf7263a71a683fab03d45d309fd42d8d9a6659/spec
 */
export class Defer20220824Handler
  implements Incremental.Handler<Defer20220824Handler.Chunk<any>>
{
  isIncrementalResult(
    result: Record<string, any>
  ): result is
    | Defer20220824Handler.SubsequentResult
    | Defer20220824Handler.InitialResult {
    return "hasNext" in result;
  }

  extractErrors(result: ApolloLink.Result<any>) {
    const acc: GraphQLFormattedError[] = [];
    const push = ({
      errors,
    }: {
      errors?: ReadonlyArray<GraphQLFormattedError>;
    }) => {
      if (errors) {
        acc.push(...errors);
      }
    };
    if (this.isIncrementalResult(result)) {
      push(result);
      if (hasIncrementalChunks(result)) {
        result.incremental.forEach(push);
      }
    }
    if (acc.length) {
      return acc;
    }
  }

  prepareRequest(request: ApolloLink.Request): ApolloLink.Request {
    if (hasDirectives(["defer", "stream"], request.query)) {
      const context = request.context ?? {};
      const http = (context.http ??= {});
      http.accept = [
        "multipart/mixed;deferSpec=20220824",
        ...(http.accept || []),
      ];
    }

    return request;
  }
  startRequest<TData extends Record<string, unknown>>(_: {
    query: DocumentNode;
  }) {
    return new DeferRequest<TData>();
  }
}

// only exported for use in tests
export function hasIncrementalChunks(
  result: Record<string, any>
): result is Required<Defer20220824Handler.SubsequentResult> {
  return isNonEmptyArray(result.incremental);
}
