import { Trie } from "@wry/trie";
import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";

import type { ApolloLink } from "@apollo/client/link";
import type { DeepPartial, HKT } from "@apollo/client/utilities";
import type { ExtensionsWithStreamDetails } from "@apollo/client/utilities/internal";
import {
  DeepMerger,
  streamDetailsSymbol,
} from "@apollo/client/utilities/internal";
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
  private pending = new Map<string, GraphQL17Alpha9Handler.PendingResult>();
  private streamDetails = new Trie<{ current: Incremental.StreamFieldDetails }>(
    true,
    () => ({ current: { isFirstChunk: true, isLastChunk: false } })
  );
  // `streamPositions` maps `pending.id` to the index that should be set by the
  // next `incremental` stream chunk to ensure the streamed array item is placed
  // at the correct point in the data array. `this.data` contains cached
  // references with the full array so we can't rely on the array length in
  // `this.data` to determine where to place item. This also ensures that items
  // updated by the cache between a streamed chunk aren't overwritten by merges
  // of future stream items from already merged stream items.
  private streamPositions: Record<string, number> = {};

  handle(
    cacheData: TData | DeepPartial<TData> | null | undefined = this.data,
    chunk: GraphQL17Alpha9Handler.Chunk<TData>
  ): FormattedExecutionResult<TData> {
    this.hasNext = chunk.hasNext;
    this.data = cacheData;

    if (chunk.pending) {
      for (const pending of chunk.pending) {
        this.pending.set(pending.id, pending);

        if ("data" in chunk) {
          const dataAtPath = pending.path.reduce(
            (data, key) => (data as any)[key],
            chunk.data
          );

          if (Array.isArray(dataAtPath)) {
            this.streamPositions[pending.id] = dataAtPath.length;
            this.streamDetails.lookupArray(pending.path as any[]).current = {
              isFirstChunk: true,
              isLastChunk: false,
            };
          }
        }
      }
    }

    if (hasIncrementalChunks(chunk)) {
      for (const incremental of chunk.incremental) {
        const pending = this.pending.get(incremental.id);

        invariant(
          pending,
          "Could not find pending chunk for incremental value. Please file an issue for the Apollo Client team to investigate."
        );

        const path = pending.path.concat(incremental.subPath ?? []);

        let data: any;
        if ("items" in incremental) {
          const items = incremental.items as any[];
          const parent: any[] = [];

          // This creates a sparse array with values set at the indices streamed
          // from the server. DeepMerger uses Object.keys and will correctly
          // place the values in this array in the correct place
          for (let i = 0; i < items.length; i++) {
            parent[i + this.streamPositions[pending.id]] = items[i];
          }

          this.streamPositions[pending.id] += items.length;
          this.streamDetails.lookupArray(path).current = {
            isFirstChunk: false,
            isLastChunk: false,
          };
          data = parent;
        } else {
          data = incremental.data;

          // Check if any pending streams added arrays from deferred data so
          // that we can update streamPositions with the initial length of the
          // array to ensure future streamed items are inserted at the right
          // starting index.
          this.pending.forEach((pendingItem) => {
            if (!(pendingItem.id in this.streamPositions)) {
              // Check if this incremental data contains array data for the pending path
              // The pending path is absolute, but incremental data is relative to the defer
              // E.g., pending.path = ["nestedObject"], pendingItem.path = ["nestedObject", "nestedFriendList"]
              // incremental.data = { scalarField: "...", nestedFriendList: [...] }
              // So we need the path from pending.path onwards
              const relativePath = pendingItem.path.slice(pending.path.length);
              const dataAtPath = relativePath.reduce(
                (data, key) => (data as any)?.[key],
                incremental.data
              );

              if (Array.isArray(dataAtPath)) {
                this.streamPositions[pendingItem.id] = dataAtPath.length;
              }
            }
          });
        }

        this.merge(
          {
            data,
            extensions: incremental.extensions,
            errors: incremental.errors,
          },
          path
        );
      }
    } else {
      this.merge(chunk);
    }

    if ("completed" in chunk && chunk.completed) {
      for (const completed of chunk.completed) {
        const { path } = this.pending.get(completed.id)!;
        const streamPosition = this.streamPositions[completed.id];

        // Truncate any stream arrays in case the chunk only contains `hasNext`
        // and `completed`.
        if (streamPosition !== undefined) {
          const dataAtPath = path.reduce(
            (data, key) => (data as any)?.[key],
            this.data
          );

          this.merge({ data: dataAtPath.slice(0, streamPosition) }, path);
        }

        this.streamDetails.lookupArray(path as any[]).current = {
          isFirstChunk: false,
          isLastChunk: true,
        };
        this.pending.delete(completed.id);

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

    result.extensions = {
      ...result.extensions,
      // Create a new object so we can check for === in QueryInfo to trigger a
      // final cache write when emitting a `hasNext: false` by itself.
      [streamDetailsSymbol]: { current: this.streamDetails },
    } satisfies ExtensionsWithStreamDetails;

    return result;
  }

  private merge(
    normalized: FormattedExecutionResult<TData>,
    atPath?: DeepMerger.MergeOptions["atPath"]
  ) {
    if (normalized.data !== undefined) {
      this.data = new DeepMerger({ arrayMerge: "truncate" }).merge(
        this.data,
        normalized.data,
        { atPath }
      );
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
      // https://specs.apollo.dev/incremental/v0.2/
      http.accept = [
        "multipart/mixed;incrementalSpec=v0.2",
        ...(http.accept || []),
      ];

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
      if ("errors" in result) {
        push(result);
      }
      if (hasIncrementalChunks(result)) {
        result.incremental.forEach(push);
      }
      if (hasCompletedChunks(result)) {
        result.completed.forEach(push);
      }
    } else if ("errors" in result) {
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

function hasCompletedChunks(
  result: Record<string, any>
): result is Required<GraphQL17Alpha9Handler.SubsequentResult> {
  return isNonEmptyArray(result.completed);
}
