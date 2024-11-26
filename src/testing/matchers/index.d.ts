import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
} from "../../core/index.js";
import type { QueryRef } from "../../react/index.js";
import { NextRenderOptions, ObservableStream } from "../internal/index.js";
import { RenderStreamMatchers } from "@testing-library/react-render-stream/expect";
import { TakeOptions } from "../internal/ObservableStream.js";

interface ApolloCustomMatchers<R = void, T = {}> {
  /**
   * Used to determine if a queryRef has been disposed.
   */
  toBeDisposed: T extends QueryRef<any, any> ? () => R
  : { error: "matcher needs to be called on a QueryRef" };
  /**
   * Used to determine if two GraphQL query documents are equal to each other by
   * comparing their printed values. The document must be parsed by `gql`.
   */
  toMatchDocument(document: DocumentNode): R;

  /**
   * Used to determine if the Suspense cache has a cache entry.
   */
  toHaveSuspenseCacheEntryUsing: T extends ApolloClient<any> ?
    (
      query: DocumentNode,
      options?: {
        variables?: OperationVariables;
        queryKey?: string | number | any[];
      }
    ) => R
  : { error: "matcher needs to be called on an ApolloClient instance" };

  toBeGarbageCollected: T extends WeakRef<any> ? () => Promise<R>
  : { error: "matcher needs to be called on a WeakRef instance" };

  toComplete: T extends ObservableStream<any> ?
    (options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitAnything: T extends ObservableStream<any> ?
    (options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitError: T extends ObservableStream<any> ?
    (error?: any, options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitNextValue: T extends ObservableStream<any> ?
    (value: any, options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };
}

declare global {
  namespace jest {
    interface Matchers<R = void, T = {}>
      extends ApolloCustomMatchers<R, T>,
        RenderStreamMatchers<R, T> {}
  }
}
