import * as React from "react";

import { canonicalStringify } from "@apollo/client/cache";
import type {
  ApolloClient,
  DefaultContext,
  DocumentNode,
  ErrorPolicy,
  FetchMoreQueryOptions,
  OperationVariables,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "@apollo/client/core";
import type {
  SubscribeToMoreFunction,
  SubscribeToMoreOptions,
} from "@apollo/client/core";
import type {
  CacheKey,
  FetchMoreFunction,
  QueryRef,
  RefetchFunction,
} from "@apollo/client/react/internal";
import {
  assertWrappedQueryRef,
  getSuspenseCache,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "@apollo/client/react/internal";
import type {
  DeepPartial,
  OnlyRequiredProperties,
} from "@apollo/client/utilities";
import { invariant } from "@apollo/client/utilities/invariant";

import { __use, useRenderGuard } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useWatchQueryOptions } from "./useSuspenseQuery.js";

type ResetFunction = () => void;

export declare namespace useLoadableQuery {
  export type LoadQueryFunction<TVariables extends OperationVariables> = (
    // Use variadic args to handle cases where TVariables is type `never`, in
    // which case we don't want to allow a variables argument. In other
    // words, we don't want to allow variables to be passed as an argument to this
    // function if the query does not expect variables in the document.
    ...args: [TVariables] extends [never] ? []
    : {} extends OnlyRequiredProperties<TVariables> ? [variables?: TVariables]
    : [variables: TVariables]
  ) => void;

  export type Result<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = [
    loadQuery: LoadQueryFunction<TVariables>,
    queryRef: QueryRef<TData, TVariables> | null,
    handlers: {
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#fetchMore:member} */
      fetchMore: FetchMoreFunction<TData, TVariables>;
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#refetch:member} */
      refetch: RefetchFunction<TData, TVariables>;
      /** {@inheritDoc @apollo/client!ObservableQuery#subscribeToMore:member(1)} */
      subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
      /**
       * A function that resets the `queryRef` back to `null`.
       */
      reset: ResetFunction;
    },
  ];

  export type FetchPolicy = Extract<
    WatchQueryFetchPolicy,
    "cache-first" | "network-only" | "no-cache" | "cache-and-network"
  >;

  export interface Options {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
    client?: ApolloClient;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: FetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#queryKey:member} */
    queryKey?: string | number | any[];

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
    refetchWritePolicy?: RefetchWritePolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
    returnPartialData?: boolean;
  }
}

export function useLoadableQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends useLoadableQuery.Options,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: useLoadableQuery.Options & TOptions
): useLoadableQuery.Result<
  TOptions["errorPolicy"] extends "ignore" | "all" ?
    TOptions["returnPartialData"] extends true ?
      DeepPartial<TData> | undefined
    : TData | undefined
  : TOptions["returnPartialData"] extends true ? DeepPartial<TData>
  : TData,
  TVariables
>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useLoadableQuery.Options & {
    returnPartialData: true;
    errorPolicy: "ignore" | "all";
  }
): useLoadableQuery.Result<DeepPartial<TData> | undefined, TVariables>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useLoadableQuery.Options & {
    errorPolicy: "ignore" | "all";
  }
): useLoadableQuery.Result<TData | undefined, TVariables>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useLoadableQuery.Options & {
    returnPartialData: true;
  }
): useLoadableQuery.Result<DeepPartial<TData>, TVariables>;

/**
 * A hook for imperatively loading a query, such as responding to a user
 * interaction.
 *
 * > Refer to the [Suspense - Fetching in response to user interaction](https://www.apollographql.com/docs/react/data/suspense#fetching-in-response-to-user-interaction) section for a more in-depth overview of `useLoadableQuery`.
 *
 * @example
 * ```jsx
 * import { gql, useLoadableQuery } from "@apollo/client";
 *
 * const GET_GREETING = gql`
 *   query GetGreeting($language: String!) {
 *     greeting(language: $language) {
 *       message
 *     }
 *   }
 * `;
 *
 * function App() {
 *   const [loadGreeting, queryRef] = useLoadableQuery(GET_GREETING);
 *
 *   return (
 *     <>
 *       <button onClick={() => loadGreeting({ language: "english" })}>
 *         Load greeting
 *       </button>
 *       <Suspense fallback={<div>Loading...</div>}>
 *         {queryRef && <Hello queryRef={queryRef} />}
 *       </Suspense>
 *     </>
 *   );
 * }
 *
 * function Hello({ queryRef }) {
 *   const { data } = useReadQuery(queryRef);
 *
 *   return <div>{data.greeting.message}</div>;
 * }
 * ```
 *
 * @since 3.9.0
 * @param query - A GraphQL query document parsed into an AST by `gql`.
 * @param options - Options to control how the query is executed.
 * @returns A tuple in the form of `[loadQuery, queryRef, handlers]`
 */
export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: useLoadableQuery.Options
): useLoadableQuery.Result<TData, TVariables>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useLoadableQuery.Options = {}
): useLoadableQuery.Result<TData, TVariables> {
  const client = useApolloClient(options.client);
  const suspenseCache = getSuspenseCache(client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { queryKey = [] } = options;

  const [queryRef, setQueryRef] = React.useState<QueryRef<
    TData,
    TVariables
  > | null>(null);

  assertWrappedQueryRef(queryRef);

  const internalQueryRef = queryRef && unwrapQueryRef(queryRef);

  if (queryRef && internalQueryRef?.didChangeOptions(watchQueryOptions)) {
    const promise = internalQueryRef.applyOptions(watchQueryOptions);
    updateWrappedQueryRef(queryRef, promise);
  }

  const calledDuringRender = useRenderGuard();

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      if (!internalQueryRef) {
        throw new Error(
          "The query has not been loaded. Please load the query."
        );
      }

      const promise = internalQueryRef.fetchMore(
        options as FetchMoreQueryOptions<TVariables, TData>
      );

      setQueryRef(wrapQueryRef(internalQueryRef));

      return promise;
    },
    [internalQueryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (options) => {
      if (!internalQueryRef) {
        throw new Error(
          "The query has not been loaded. Please load the query."
        );
      }

      const promise = internalQueryRef.refetch(options);

      setQueryRef(wrapQueryRef(internalQueryRef));

      return promise;
    },
    [internalQueryRef]
  );

  const loadQuery: useLoadableQuery.LoadQueryFunction<TVariables> =
    React.useCallback(
      (...args) => {
        invariant(
          !calledDuringRender(),
          "useLoadableQuery: 'loadQuery' should not be called during render. To start a query during render, use the 'useBackgroundQuery' hook."
        );

        const [variables] = args;

        const cacheKey: CacheKey = [
          query,
          canonicalStringify(variables),
          ...([] as any[]).concat(queryKey),
        ];

        const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
          client.watchQuery({
            ...watchQueryOptions,
            variables,
          } as WatchQueryOptions<any, any>)
        );

        setQueryRef(wrapQueryRef(queryRef));
      },
      [
        query,
        queryKey,
        suspenseCache,
        watchQueryOptions,
        calledDuringRender,
        client,
      ]
    );

  const subscribeToMore: SubscribeToMoreFunction<TData, TVariables> =
    React.useCallback(
      (options) => {
        invariant(
          internalQueryRef,
          "The query has not been loaded. Please load the query."
        );

        return internalQueryRef.observable.subscribeToMore(
          // TODO: The internalQueryRef doesn't have TVariables' type information so we have to cast it here
          options as any as SubscribeToMoreOptions<TData, OperationVariables>
        );
      },
      [internalQueryRef]
    );

  const reset: ResetFunction = React.useCallback(() => {
    setQueryRef(null);
  }, []);

  return [loadQuery, queryRef, { fetchMore, refetch, reset, subscribeToMore }];
}
