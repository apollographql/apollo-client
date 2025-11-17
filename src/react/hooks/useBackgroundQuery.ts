import * as React from "react";

import type {
  ApolloClient,
  DataState,
  DefaultContext,
  DocumentNode,
  ErrorPolicy,
  OperationVariables,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from "@apollo/client";
import type { SubscribeToMoreFunction } from "@apollo/client";
import type { QueryRef } from "@apollo/client/react";
import type {
  FetchMoreFunction,
  RefetchFunction,
} from "@apollo/client/react/internal";
import {
  getSuspenseCache,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "@apollo/client/react/internal";
import type {
  DocumentationTypes as UtilityDocumentationTypes,
  NoInfer,
  VariablesOption,
} from "@apollo/client/utilities/internal";

import type { SkipToken } from "./constants.js";
import { useSuspenseHookCacheKey, wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useWatchQueryOptions } from "./useSuspenseQuery.js";

export declare namespace useBackgroundQuery {
  import _self = useBackgroundQuery;
  export type FetchPolicy = Extract<
    WatchQueryFetchPolicy,
    "cache-first" | "network-only" | "no-cache" | "cache-and-network"
  >;

  export namespace Base {
    export interface Options {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
      client?: ApolloClient;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy_suspense:member} */
      refetchWritePolicy?: RefetchWritePolicy;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
      errorPolicy?: ErrorPolicy;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
      context?: DefaultContext;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
      returnPartialData?: boolean;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
      fetchPolicy?: FetchPolicy;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#queryKey:member} */
      queryKey?: string | number | any[];

      /**
       * {@inheritDoc @apollo/client!QueryOptionsDocumentation#skip_deprecated:member}
       *
       * @example Recommended usage of `skipToken`:
       *
       * ```ts
       * import { skipToken, useBackgroundQuery } from "@apollo/client";
       *
       * const [queryRef] = useBackgroundQuery(
       *   query,
       *   id ? { variables: { id } } : skipToken
       * );
       * ```
       */
      skip?: boolean;
    }
  }

  export type Options<
    TVariables extends OperationVariables = OperationVariables,
  > = Base.Options & VariablesOption<TVariables>;

  export namespace DocumentationTypes {
    namespace useBackgroundQuery {
      export interface Options<
        TVariables extends OperationVariables = OperationVariables,
      > extends Base.Options,
          UtilityDocumentationTypes.VariableOptions<TVariables> {}
    }
  }

  export interface Result<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > {
    /** {@inheritDoc @apollo/client!ObservableQuery#subscribeToMore:member(1)} */
    subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;

    /**
     * {@inheritDoc @apollo/client!ObservableQuery#fetchMore:member(1)}
     *
     * @remarks
     * Calling this function will cause the component to re-suspend, unless the call site is wrapped in [`startTransition`](https://react.dev/reference/react/startTransition).
     */
    fetchMore: FetchMoreFunction<TData, TVariables>;

    /**
     * {@inheritDoc @apollo/client!QueryResultDocumentation#refetch:member}
     *
     * @remarks
     * Calling this function will cause the component to re-suspend, unless the call site is wrapped in [`startTransition`](https://react.dev/reference/react/startTransition).
     */
    refetch: RefetchFunction<TData, TVariables>;
  }

  namespace DocumentationTypes {
    namespace useBackgroundQuery {
      export interface Result<
        TData = unknown,
        TVariables extends OperationVariables = OperationVariables,
      > extends _self.Result<TData, TVariables> {}
    }
  }

  export namespace DocumentationTypes {
    /** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
    export function useBackgroundQuery<
      TData = unknown,
      TVariables extends OperationVariables = OperationVariables,
    >(
      query: DocumentNode | TypedDocumentNode<TData, TVariables>,
      options: SkipToken | useBackgroundQuery.Options<TVariables>
    ): [
      QueryRef<TData, TVariables> | undefined,
      useBackgroundQuery.Result<TData, TVariables>,
    ];
  }
}

/**
 * For a detailed explanation of useBackgroundQuery, see the [fetching with Suspense reference](https://www.apollographql.com/docs/react/data/suspense).
 *
 * @returns A tuple containing:
 *
 * 1.  A `QueryRef` that can be passed to `useReadQuery` to read the query result. The `queryRef` is `undefined` if the query is skipped.
 * 2.  An object containing helper functions for the query:
 *     - `refetch`: A function to re-execute the query
 *     - `fetchMore`: A function to fetch more results for pagination
 *     - `subscribeToMore`: A function to subscribe to updates
 *
 * @example
 *
 * ```jsx
 * import { Suspense } from "react";
 * import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
 * import { useBackgroundQuery, useReadQuery } from "@apollo/client/react";
 *
 * const query = gql`
 *   foo {
 *     bar
 *   }
 * `;
 *
 * const client = new ApolloClient({
 *   link: new HttpLink({ uri: "http://localhost:4000/graphql" }),
 *   cache: new InMemoryCache(),
 * });
 *
 * function SuspenseFallback() {
 *   return <div>Loading...</div>;
 * }
 *
 * function Child({ queryRef }) {
 *   const { data } = useReadQuery(queryRef);
 *
 *   return <div>{data.foo.bar}</div>;
 * }
 *
 * function Parent() {
 *   const [queryRef] = useBackgroundQuery(query);
 *
 *   return (
 *     <Suspense fallback={<SuspenseFallback />}>
 *       <Child queryRef={queryRef} />
 *     </Suspense>
 *   );
 * }
 *
 * function App() {
 *   return (
 *     <ApolloProvider client={client}>
 *       <Parent />
 *     </ApolloProvider>
 *   );
 * }
 * ```
 *
 * @param query - A GraphQL query document parsed into an AST by `gql`.
 * @param options - An optional object containing options for the query. Instead of passing a `useBackgroundQuery.Options` object into the hook, you can also pass a [`skipToken`](#skiptoken) to prevent the `useBackgroundQuery` hook from executing the query or suspending.
 */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    /** @deprecated `returnPartialData` has no effect on `no-cache` queries */
    returnPartialData: boolean;
    fetchPolicy: "no-cache";
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming">,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: false;
    errorPolicy: "ignore" | "all";
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "empty">,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: boolean;
    errorPolicy: "ignore" | "all";
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "partial" | "empty">,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    errorPolicy: "ignore" | "all";
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "empty">,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    skip: boolean;
    returnPartialData: false;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    skip: boolean;
    returnPartialData: boolean;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "partial"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: false;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming">,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: boolean;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "partial">,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    skip: boolean;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken
): [undefined, useBackgroundQuery.Result<TData, TVariables>];

/** {@inheritDoc @apollo/client/react!useBackgroundQuery:function(1)} */
export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (useBackgroundQuery.Options<NoInfer<TVariables>> & {
        returnPartialData: false;
      })
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (useBackgroundQuery.Options<NoInfer<TVariables>> & {
        returnPartialData: boolean;
      })
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "partial"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [options?: useBackgroundQuery.Options<NoInfer<TVariables>>]
  : [options: useBackgroundQuery.Options<NoInfer<TVariables>>]
): [
  QueryRef<TData, TVariables, "complete" | "streaming">,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [options?: SkipToken | useBackgroundQuery.Options<NoInfer<TVariables>>]
  : [options: SkipToken | useBackgroundQuery.Options<NoInfer<TVariables>>]
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken | useBackgroundQuery.Options<NoInfer<TVariables>>
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SkipToken | useBackgroundQuery.Options<NoInfer<TVariables>>
): [
  QueryRef<TData, TVariables, DataState<TData>["dataState"]> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
] {
  "use no memo";
  return wrapHook(
    "useBackgroundQuery",
    // eslint-disable-next-line react-compiler/react-compiler
    useBackgroundQuery_,
    useApolloClient(typeof options === "object" ? options.client : undefined)
  )(query, options ?? ({} as any));
}

function useBackgroundQuery_<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TStates extends DataState<TData>["dataState"] = DataState<TData>["dataState"],
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | (SkipToken & Partial<useBackgroundQuery.Options<NoInfer<TVariables>>>)
    | useBackgroundQuery.Options<NoInfer<TVariables>>
): [
  QueryRef<TData, TVariables, TStates> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
] {
  const client = useApolloClient(options.client);
  const suspenseCache = getSuspenseCache(client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { fetchPolicy } = watchQueryOptions;
  const cacheKey = useSuspenseHookCacheKey(query, options);

  // This ref tracks the first time query execution is enabled to determine
  // whether to return a query ref or `undefined`. When initialized
  // in a skipped state (either via `skip: true` or `skipToken`) we return
  // `undefined` for the `queryRef` until the query has been enabled. Once
  // enabled, a query ref is always returned regardless of whether the query is
  // skipped again later.
  const didFetchResult = React.useRef(fetchPolicy !== "standby");
  didFetchResult.current ||= fetchPolicy !== "standby";

  const queryRef = suspenseCache.getQueryRef<TData, TStates>(cacheKey, () =>
    client.watchQuery(
      watchQueryOptions as ApolloClient.WatchQueryOptions<any, any>
    )
  );

  const [wrappedQueryRef, setWrappedQueryRef] = React.useState(
    wrapQueryRef(queryRef)
  );
  if (unwrapQueryRef(wrappedQueryRef) !== queryRef) {
    setWrappedQueryRef(wrapQueryRef(queryRef));
  }
  if (queryRef.didChangeOptions(watchQueryOptions)) {
    const promise = queryRef.applyOptions(watchQueryOptions);
    updateWrappedQueryRef(wrappedQueryRef, promise);
  }

  // This prevents issues where rerendering useBackgroundQuery after the
  // queryRef has been disposed would cause the hook to return a new queryRef
  // instance since disposal also removes it from the suspense cache. We add
  // the queryRef back in the suspense cache so that the next render will reuse
  // this queryRef rather than initializing a new instance.
  React.useEffect(() => {
    // Since the queryRef is disposed async via `setTimeout`, we have to wait a
    // tick before checking it and adding back to the suspense cache.
    const id = setTimeout(() => {
      if (queryRef.disposed) {
        suspenseCache.add(cacheKey, queryRef);
      }
    });

    return () => clearTimeout(id);
    // Omitting the deps is intentional. This avoids stale closures and the
    // conditional ensures we aren't running the logic on each render.
  });

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      const promise = queryRef.fetchMore(options);

      setWrappedQueryRef(wrapQueryRef(queryRef));

      return promise;
    },
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (variables) => {
      const promise = queryRef.refetch(variables);

      setWrappedQueryRef(wrapQueryRef(queryRef));

      return promise;
    },
    [queryRef]
  );

  React.useEffect(() => queryRef.softRetain(), [queryRef]);

  return [
    didFetchResult.current ? wrappedQueryRef : void 0,
    {
      fetchMore,
      refetch,
      // TODO: The internalQueryRef doesn't have TVariables' type information so we have to cast it here
      subscribeToMore: queryRef.observable
        .subscribeToMore as SubscribeToMoreFunction<TData, TVariables>,
    },
  ];
}
