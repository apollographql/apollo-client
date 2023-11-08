import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
} from "../../core/index.js";
import {
  NextRenderOptions,
  ProfiledComponent,
  ProfiledHook,
} from "../internal/index.js";

interface ApolloCustomMatchers<R = void, T = {}> {
  /**
   * Used to determine if two GraphQL query documents are equal to each other by
   * comparing their printed values. The document must be parsed by `gql`.
   */
  toMatchDocument(document: DocumentNode): R;

  toHaveRendered(): R;
  toHaveRenderedTimes(count: number): R;

  /**
   * Used to determine if the Suspense cache has a cache entry.
   */
  toHaveSuspenseCacheEntryUsing: T extends ApolloClient<any>
    ? (
        query: DocumentNode,
        options?: {
          variables?: OperationVariables;
          queryKey?: string | number | any[];
        }
      ) => R
    : { error: "matcher needs to be called on an ApolloClient instance" };

  toRerender: T extends ProfiledComponent<any, any> | ProfiledHook<any, any>
    ? (options?: NextRenderOptions) => Promise<R>
    : { error: "matcher needs to be called on a ProfiledComponent instance" };

  toRenderExactlyTimes: T extends
    | ProfiledComponent<any, any>
    | ProfiledHook<any, any>
    ? (count: number, options?: NextRenderOptions) => Promise<R>
    : { error: "matcher needs to be called on a ProfiledComponent instance" };
}

declare global {
  namespace jest {
    interface Matchers<R = void, T = {}> extends ApolloCustomMatchers<R, T> {}
  }
}
