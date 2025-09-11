import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";

import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial, HKT } from "@apollo/client/utilities";
import { DeepMerger } from "@apollo/client/utilities/internal";
import {
  hasDirectives,
  isNonEmptyArray,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

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

  export type InitialResult<TData = Record<string, unknown>> = {
    data: TData;
    errors?: ReadonlyArray<GraphQLFormattedError>;
    pending: ReadonlyArray<PendingResult>;
    hasNext: boolean;
    extensions?: Record<string, unknown>;
  };

  export type SubsequentResult<TData = unknown> = {
    hasNext: boolean;
    pending?: ReadonlyArray<PendingResult>;
    incremental?: ReadonlyArray<IncrementalResult<TData>>;
    completed?: ReadonlyArray<CompletedResult>;
    extensions?: Record<string, unknown>;
  };

  export interface PendingResult {
    id: string;
    path: Incremental.Path;
    label?: string;
  }

  export interface CompletedResult {
    id: string;
    errors?: ReadonlyArray<GraphQLFormattedError>;
  }

  export interface IncrementalDeferResult<TData = Record<string, unknown>> {
    errors?: ReadonlyArray<GraphQLFormattedError>;
    data: TData;
    id: string;
    subPath?: Incremental.Path;
    extensions?: Record<string, unknown>;
  }

  export interface IncrementalStreamResult<TData = ReadonlyArray<unknown>> {
    errors?: ReadonlyArray<GraphQLFormattedError>;
    items: TData;
    id: string;
    subPath?: Incremental.Path;
    extensions?: Record<string, unknown>;
  }

  export type IncrementalResult<TData = unknown> =
    | IncrementalDeferResult<TData>
    | IncrementalStreamResult<TData>;

  export type Chunk<TData> = InitialResult<TData> | SubsequentResult<TData>;
}

class IncrementalRequest<TData>
  implements
    Incremental.IncrementalRequest<GraphQL17Alpha9Handler.Chunk<TData>, TData>
{
  hasNext = true;

  private data: any = {};
  private errors: GraphQLFormattedError[] = [];
  private extensions: Record<string, any> = {};
  private pending: GraphQL17Alpha9Handler.PendingResult[] = [];
  private mergedIndexes: Record<string, number> = {};

  handle(
    cacheData: TData | DeepPartial<TData> | null | undefined = this.data,
    chunk: GraphQL17Alpha9Handler.Chunk<TData>
  ): FormattedExecutionResult<TData> {
    this.hasNext = chunk.hasNext;
    this.data = cacheData;

    if (chunk.pending) {
      this.pending.push(...chunk.pending);

      if ("data" in chunk) {
        for (const pending of chunk.pending) {
          const dataAtPath = pending.path.reduce(
            (data, key) => (data as any)[key],
            chunk.data
          );

          if (Array.isArray(dataAtPath)) {
            this.mergedIndexes[pending.id] = dataAtPath.length;
          }
        }
      }
    }

    this.merge(chunk);

    if (hasIncrementalChunks(chunk)) {
      for (const incremental of chunk.incremental) {
        const pending = this.pending.find(({ id }) => incremental.id === id);

        invariant(
          pending,
          "Could not find pending chunk for incremental value. Please file an issue for the Apollo Client team to investigate."
        );

        const path = pending.path.concat(incremental.subPath ?? []);

        let data: any;
        if ("items" in incremental) {
          const items = incremental.items as any[];
          const parent: any[] = [];

          if (!(pending.id in this.mergedIndexes)) {
            const dataAtPath = pending.path.reduce(
              (data, key) => (data as any)[key],
              this.data
            );

            this.mergedIndexes[pending.id] = dataAtPath.length;
          }

          for (let i = 0!; i < items.length; i++) {
            parent[i + this.mergedIndexes[pending.id]] = items[i];
          }

          this.mergedIndexes[pending.id] += items.length;
          data = parent;
        } else {
          data = incremental.data;
        }

        for (let i = path.length - 1; i >= 0; i--) {
          const key = path[i];
          const parent: Record<string | number, any> =
            typeof key === "number" ? [] : {};
          parent[key] = data;
          data = parent as typeof data;
        }

        this.merge({
          data,
          extensions: incremental.extensions,
          errors: incremental.errors,
        });
      }
    }

    if ("completed" in chunk && chunk.completed) {
      for (const completed of chunk.completed) {
        this.pending = this.pending.filter(({ id }) => id !== completed.id);

        if (completed.errors) {
          this.errors.push(...completed.errors);
        }
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

  private merge(normalized: FormattedExecutionResult<TData>) {
    if (normalized.data !== undefined) {
      this.data = new DeepMerger().merge(this.data, normalized.data);
    }

    if (normalized.errors) {
      this.errors.push(...normalized.errors);
    }

    Object.assign(this.extensions, normalized.extensions);
  }
}

/**
 * Provides handling for the incremental delivery specification implemented by
 * graphql.js version `17.0.0-alpha.9`.
 */
export class GraphQL17Alpha9Handler
  implements Incremental.Handler<GraphQL17Alpha9Handler.Chunk<any>>
{
  /** @internal */
  isIncrementalResult(
    result: ApolloLink.Result<any>
  ): result is
    | GraphQL17Alpha9Handler.InitialResult
    | GraphQL17Alpha9Handler.SubsequentResult {
    return "hasNext" in result;
  }

  /** @internal */
  prepareRequest(request: ApolloLink.Request): ApolloLink.Request {
    if (hasDirectives(["defer", "stream"], request.query)) {
      const context = request.context ?? {};
      const http = (context.http ??= {});
      http.accept = ["multipart/mixed", ...(http.accept || [])];

      request.context = context;
    }

    return request;
  }

  /** @internal */
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
      push(new IncrementalRequest().handle(undefined, result));
    } else {
      push(result);
    }

    if (acc.length) {
      return acc;
    }
  }

  /** @internal */
  startRequest<TData>(_: { query: DocumentNode }) {
    return new IncrementalRequest<TData>();
  }
}

function hasIncrementalChunks(
  result: Record<string, any>
): result is Required<GraphQL17Alpha9Handler.SubsequentResult> {
  return isNonEmptyArray(result.incremental);
}
