import type {
  ApolloClient,
  DefaultContext,
  DocumentNode,
  ErrorPolicy,
  OperationVariables,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from "@apollo/client";
import type { PreloadedQueryRef } from "@apollo/client/react";
import {
  assertWrappedQueryRef,
  getWrappedPromise,
  InternalQueryReference,
  wrapQueryRef,
} from "@apollo/client/react/internal";
import type {
  NoInfer,
  VariablesOption,
} from "@apollo/client/utilities/internal";

import { wrapHook } from "../hooks/internal/index.js";

export type PreloadQueryFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export type PreloadQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
> = {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: PreloadQueryFetchPolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
  returnPartialData?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
  refetchWritePolicy?: RefetchWritePolicy;
} & VariablesOption<TVariables>;

/**
 * A function that will begin loading a query when called. It's result can be
 * read by `useReadQuery` which will suspend until the query is loaded.
 * This is useful when you want to start loading a query as early as possible
 * outside of a React component.
 *
 * @example
 *
 * ```js
 * const preloadQuery = createQueryPreloader(client);
 * const queryRef = preloadQuery(query, { variables, ...otherOptions });
 *
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading</div>}>
 *       <MyQuery />
 *     </Suspense>
 *   );
 * }
 *
 * function MyQuery() {
 *   const { data } = useReadQuery(queryRef);
 *
 *   // do something with `data`
 * }
 * ```
 */
export interface PreloadQueryFunction {
  /** {@inheritDoc @apollo/client/react!PreloadQueryFunction:interface} */
  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      returnPartialData: true;
      errorPolicy: "ignore" | "all";
    }
  ): PreloadedQueryRef<
    TData,
    TVariables,
    "complete" | "streaming" | "partial" | "empty"
  >;

  /** {@inheritDoc @apollo/client/react!PreloadQueryFunction:interface} */
  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      errorPolicy: "ignore" | "all";
    }
  ): PreloadedQueryRef<TData, TVariables, "complete" | "streaming" | "empty">;

  /** {@inheritDoc @apollo/client/react!PreloadQueryFunction:interface} */
  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      returnPartialData: true;
    }
  ): PreloadedQueryRef<TData, TVariables, "complete" | "streaming" | "partial">;

  /** {@inheritDoc @apollo/client/react!PreloadQueryFunction:interface} */
  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    ...[options]: {} extends TVariables ?
      [options?: PreloadQueryOptions<NoInfer<TVariables>>]
    : [options: PreloadQueryOptions<NoInfer<TVariables>>]
  ): PreloadedQueryRef<TData, TVariables, "complete" | "streaming">;

  /**
   * A function that returns a promise that resolves when the query has finished
   * loading. The promise resolves with the `QueryReference` itself.
   *
   * @remarks
   * This method is useful for preloading queries in data loading routers, such
   * as [React Router](https://reactrouter.com/en/main) or [TanStack Router](https://tanstack.com/router),
   * to prevent routes from transitioning until the query has finished loading.
   * `data` is not exposed on the promise to discourage using the data in
   * `loader` functions and exposing it to your route components. Instead, we
   * prefer you rely on `useReadQuery` to access the data to ensure your
   * component can rerender with cache updates. If you need to access raw query
   * data, use `client.query()` directly.
   *
   * @example
   * Here's an example using React Router's `loader` function:
   *
   * ```ts
   * import { createQueryPreloader } from "@apollo/client";
   *
   * const preloadQuery = createQueryPreloader(client);
   *
   * export async function loader() {
   *   const queryRef = preloadQuery(GET_DOGS_QUERY);
   *
   *   return preloadQuery.toPromise(queryRef);
   * }
   *
   * export function RouteComponent() {
   *   const queryRef = useLoaderData();
   *   const { data } = useReadQuery(queryRef);
   *
   *   // ...
   * }
   * ```
   */
  toPromise<TQueryRef extends PreloadedQueryRef<any, any, any>>(
    queryRef: TQueryRef
  ): Promise<TQueryRef>;
}

/**
 * A higher order function that returns a `preloadQuery` function which
 * can be used to begin loading a query with the given `client`. This is useful
 * when you want to start loading a query as early as possible outside of a
 * React component.
 *
 * > Refer to the [Suspense - Initiating queries outside React](https://www.apollographql.com/docs/react/data/suspense#initiating-queries-outside-react) section for a more in-depth overview.
 *
 * @param client - The `ApolloClient` instance that will be used to load queries
 * from the returned `preloadQuery` function.
 * @returns The `preloadQuery` function.
 *
 * @example
 *
 * ```js
 * const preloadQuery = createQueryPreloader(client);
 * ```
 */
export function createQueryPreloader(
  client: ApolloClient
): PreloadQueryFunction {
  return wrapHook(
    "createQueryPreloader",
    _createQueryPreloader,
    client
  )(client);
}

const _createQueryPreloader: typeof createQueryPreloader = (client) => {
  function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> &
      VariablesOption<TVariables> = {} as any
  ): PreloadedQueryRef<TData, TVariables> {
    const queryRef = new InternalQueryReference(
      client.watchQuery({
        ...options,
        query,
        notifyOnNetworkStatusChange: false,
      } as ApolloClient.WatchQueryOptions<any, any>),
      {
        autoDisposeTimeoutMs:
          client.defaultOptions.react?.suspense?.autoDisposeTimeoutMs,
      }
    );

    return wrapQueryRef(queryRef) as unknown as PreloadedQueryRef<
      TData,
      TVariables
    >;
  }

  return Object.assign(preloadQuery, {
    toPromise<TQueryRef extends PreloadedQueryRef<any, any, any>>(
      queryRef: TQueryRef
    ) {
      assertWrappedQueryRef(queryRef);
      return getWrappedPromise(queryRef).then(() => queryRef);
    },
  });
};
