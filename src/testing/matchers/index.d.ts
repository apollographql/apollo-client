import type {
  ApolloClient,
  ApolloQueryResult,
  DocumentNode,
  FetchResult,
  ObservableQuery,
  OperationVariables,
} from "../../core/index.js";
import type { QueryRef } from "../../react/index.js";
import { NextRenderOptions, ObservableStream } from "../internal/index.js";
import { RenderStreamMatchers } from "@testing-library/react-render-stream/expect";
import { TakeOptions } from "../internal/ObservableStream.js";

// Unfortunately TypeScript does not have a way to determine if a generic
// argument is a class or not, so we need to manually keep track of known class
// intances that we filter out.
type KnownClassInstances = ApolloClient | ObservableQuery<any, any>;
type FilterUnserializableProperties<
  T,
  Options extends { includeKnownClassInstances: boolean } = {
    includeKnownClassInstances: false;
  },
> = T extends Array<infer TItem> ? Array<FilterUnserializableProperties<TItem>>
: T extends Record<string, any> ?
  {
    [K in keyof T as T[K] extends (...args: any[]) => any ? never
    : false extends Options["includeKnownClassInstances"] ?
      T[K] extends KnownClassInstances ?
        never
      : K
    : K]: T[K];
  }
: T;

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

  /**
   * Used to determine if the observable stream emitted a `next` event. Use
   * `toEmitValue` to check if the `next` event emitted a specific value.
   */
  toEmitNext: T extends ObservableStream<any> ?
    (options?: TakeOptions) => Promise<R>
  : { error: "matcher needs to be called on an ObservableStream instance" };

  toEmitTypedValue: T extends ObservableStream<infer TResult> ?
    (
      expected: FilterUnserializableProperties<TResult>,
      options?: TakeOptions
    ) => Promise<R>
  : { error: "toEmitTypedValue needs to be called on an ObservableStream" };

  toStrictEqualTyped: [T] extends [Promise<infer TResult>] ?
    <
      TOptions extends { includeKnownClassInstances: boolean } = {
        includeKnownClassInstances: false;
      },
    >(
      expected: FilterUnserializableProperties<
        TResult,
        { includeKnownClassInstances: TOptions["includeKnownClassInstances"] }
      >,
      options?: TOptions
    ) => R
  : <
      TOptions extends { includeKnownClassInstances: boolean } = {
        includeKnownClassInstances: false;
      },
    >(
      expected: FilterUnserializableProperties<
        T,
        { includeKnownClassInstances: TOptions["includeKnownClassInstances"] }
      >,
      options?: TOptions
    ) => R;
}

interface ApolloCustomAsymmetricMatchers {
  arrayWithLength: (length: number) => any;
}

declare global {
  namespace jest {
    interface Matchers<R = void, T = {}>
      extends ApolloCustomMatchers<R, T>,
        RenderStreamMatchers<R, T> {}

    interface Expect extends ApolloCustomAsymmetricMatchers {}
  }
}
