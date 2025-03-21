import type {
  ApolloClient,
  ApolloQueryResult,
  DocumentNode,
  FetchResult,
  ObservableQuery,
  OperationVariables,
} from "../../core/index.js";
import type { useQuery, useLazyQuery, QueryRef } from "../../react/index.js";
import { NextRenderOptions, ObservableStream } from "../internal/index.js";
import { RenderStreamMatchers } from "@testing-library/react-render-stream/expect";
import { TakeOptions } from "../internal/ObservableStream.js";
import { CheckedKeys } from "./toEqualQueryResult.js";
import { CheckedLazyQueryResult } from "./toEqualLazyQueryResult.js";

// Unfortunately TypeScript does not have a way to determine if a generic
// argument is a class or not, so we need to manually keep track of known class
// intances that we filter out.
type KnownClassInstances = ApolloClient | ObservableQuery;
type FilterUnserializableProperties<T extends Record<string, any>> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never
  : T[K] extends KnownClassInstances ? never
  : K]: T[K];
};

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

  toEmitApolloQueryResult: T extends ObservableStream<infer QueryResult> ?
    QueryResult extends ApolloQueryResult<infer TData> ?
      (value: ApolloQueryResult<TData>, options?: TakeOptions) => Promise<R>
    : { error: "matcher needs to be matched with an ApolloQueryResult" }
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitAnything: T extends ObservableStream<any> ?
    (options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitError: T extends ObservableStream<any> ?
    (error?: any, options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitFetchResult: T extends ObservableStream<FetchResult<infer TData>> ?
    (value: FetchResult<TData>, options?: TakeOptions) => Promise<R>
  : {
      error: "matcher needs to be called on an ObservableStream<FetchResult<TData>> instance";
    };

  /**
   * Used to determine if the observable stream emitted a `next` event. Use
   * `toEmitValue` to check if the `next` event emitted a specific value.
   */
  toEmitNext: T extends ObservableStream<any> ?
    (options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitValue: T extends ObservableStream<any> ?
    (value: any, options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitValueStrict: T extends ObservableStream<any> ?
    (value: any, options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitMatchedValue: T extends ObservableStream<any> ?
    (value: any, options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  /** @deprecated Use `toEqualStrictTyped` instead */
  toEqualApolloQueryResult: T extends ApolloQueryResult<infer TData> ?
    (expected: ApolloQueryResult<TData>) => R
  : T extends Promise<ApolloQueryResult<infer TData>> ?
    (expected: ApolloQueryResult<TData>) => R
  : { error: "matchers needs to be called on an ApolloQueryResult" };

  /** @deprecated Use `toEqualStrictTyped` instead */
  toEqualLazyQueryResult: T extends (
    useLazyQuery.Result<infer TData, infer TVariables>
  ) ?
    (expected: CheckedLazyQueryResult<TData, TVariables>) => R
  : T extends Promise<useLazyQuery.Result<infer TData, infer TVariables>> ?
    (expected: CheckedLazyQueryResult<TData, TVariables>) => R
  : { error: "matchers needs to be called on a LazyQueryResult" };

  /** @deprecated Use `toEqualStrictTyped` instead */
  toEqualQueryResult: T extends useQuery.Result<infer TData, infer TVariables> ?
    (expected: Pick<useQuery.Result<TData, TVariables>, CheckedKeys>) => R
  : T extends Promise<useQuery.Result<infer TData, infer TVariables>> ?
    (expected: Pick<useQuery.Result<TData, TVariables>, CheckedKeys>) => R
  : { error: "matchers needs to be called on a QueryResult" };

  /** @deprecated Use `toEqualStrictTyped` instead */
  toEqualFetchResult: T extends (
    FetchResult<infer TData, infer TContext, infer TExtensions>
  ) ?
    (expected: FetchResult<TData, TContext, TExtensions>) => R
  : T extends (
    Promise<FetchResult<infer TData, infer TContext, infer TExtensions>>
  ) ?
    (expected: FetchResult<TData, TContext, TExtensions>) => R
  : { error: "matchers needs to be called on a FetchResult" };

  toEqualStrictTyped: T extends Promise<infer TResult> ?
    (expected: FilterUnserializableProperties<TResult>) => R
  : (expected: FilterUnserializableProperties<T>) => R;
}

declare global {
  namespace jest {
    interface Matchers<R = void, T = {}>
      extends ApolloCustomMatchers<R, T>,
        RenderStreamMatchers<R, T> {}
  }
}
