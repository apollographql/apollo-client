import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
} from "../../core/index.js";
import type { QueryRef } from "../../react/index.js";
import {
  NextRenderOptions,
  Profiler,
  ProfiledComponent,
  ProfiledHook,
} from "../internal/index.js";

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

  toRerender: T extends (
    Profiler<any, any> | ProfiledComponent<any, any> | ProfiledHook<any, any>
  ) ?
    (options?: NextRenderOptions) => Promise<R>
  : { error: "matcher needs to be called on a ProfiledComponent instance" };

  toRenderExactlyTimes: T extends (
    Profiler<any, any> | ProfiledComponent<any, any> | ProfiledHook<any, any>
  ) ?
    (count: number, options?: NextRenderOptions) => Promise<R>
  : { error: "matcher needs to be called on a ProfiledComponent instance" };

  toBeGarbageCollected: T extends WeakRef<any> ? () => Promise<R>
  : { error: "matcher needs to be called on a WeakRef instance" };
}

declare global {
  namespace jest {
    interface Matchers<R = void, T = {}> extends ApolloCustomMatchers<R, T> {}
  }
}
