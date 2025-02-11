import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { DocumentNode } from "graphql";
import * as React from "rehackt";

import type {
  ApolloClient,
  DefaultContext,
  ErrorPolicy,
  ObservableQuery,
  OperationVariables,
  RefetchWritePolicy,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "@apollo/client/core";
import type {
  NoInfer,
  QueryHookOptions,
  QueryResult,
} from "@apollo/client/react";
import { mergeOptions } from "@apollo/client/utilities";

import type { NextFetchPolicyContext } from "../../core/watchQueryOptions.js";

import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import type { InternalResult } from "./useQuery.js";
import {
  createMakeWatchQueryOptions,
  getObsQueryOptions,
  toQueryResult,
  useQueryInternals,
} from "./useQuery.js";

export interface LazyQueryHookOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: WatchQueryFetchPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#nextFetchPolicy:member} */
  nextFetchPolicy?:
    | WatchQueryFetchPolicy
    | ((
        this: WatchQueryOptions<TVariables, TData>,
        currentFetchPolicy: WatchQueryFetchPolicy,
        context: NextFetchPolicyContext<TData, TVariables>
      ) => WatchQueryFetchPolicy);

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#initialFetchPolicy:member} */
  initialFetchPolicy?: WatchQueryFetchPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
  refetchWritePolicy?: RefetchWritePolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#pollInterval:member} */
  pollInterval?: number;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#notifyOnNetworkStatusChange:member} */
  notifyOnNetworkStatusChange?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
  returnPartialData?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#canonizeResults:member} */
  canonizeResults?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skipPollAttempt:member} */
  skipPollAttempt?: () => boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#ssr:member} */
  ssr?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
  client?: ApolloClient<any>;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
}

export interface LazyQueryHookExecOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: WatchQueryFetchPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#nextFetchPolicy:member} */
  nextFetchPolicy?:
    | WatchQueryFetchPolicy
    | ((
        this: WatchQueryOptions<TVariables, TData>,
        currentFetchPolicy: WatchQueryFetchPolicy,
        context: NextFetchPolicyContext<TData, TVariables>
      ) => WatchQueryFetchPolicy);

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#initialFetchPolicy:member} */
  initialFetchPolicy?: WatchQueryFetchPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
  refetchWritePolicy?: RefetchWritePolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: TVariables;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#pollInterval:member} */
  pollInterval?: number;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#notifyOnNetworkStatusChange:member} */
  notifyOnNetworkStatusChange?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
  returnPartialData?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#canonizeResults:member} */
  canonizeResults?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skipPollAttempt:member} */
  skipPollAttempt?: () => boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#ssr:member} */
  ssr?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
  client?: ApolloClient<any>;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;

  query?: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export type LazyQueryResultTuple<
  TData,
  TVariables extends OperationVariables,
> = [
  execute: LazyQueryExecFunction<TData, TVariables>,
  result: QueryResult<TData, TVariables>,
];

export type LazyQueryExecFunction<
  TData,
  TVariables extends OperationVariables,
> = (
  options?: LazyQueryHookExecOptions<TData, TVariables>
) => Promise<QueryResult<TData, TVariables>>;

// The following methods, when called will execute the query, regardless of
// whether the useLazyQuery execute function was called before.
const EAGER_METHODS = [
  "refetch",
  "reobserve",
  "fetchMore",
  "updateQuery",
  "startPolling",
  "stopPolling",
  "subscribeToMore",
] as const;

/**
 * A hook for imperatively executing queries in an Apollo application, e.g. in response to user interaction.
 *
 * > Refer to the [Queries - Manual execution with useLazyQuery](https://www.apollographql.com/docs/react/data/queries#manual-execution-with-uselazyquery) section for a more in-depth overview of `useLazyQuery`.
 *
 * @example
 * ```jsx
 * import { gql, useLazyQuery } from "@apollo/client";
 *
 * const GET_GREETING = gql`
 *   query GetGreeting($language: String!) {
 *     greeting(language: $language) {
 *       message
 *     }
 *   }
 * `;
 *
 * function Hello() {
 *   const [loadGreeting, { called, loading, data }] = useLazyQuery(
 *     GET_GREETING,
 *     { variables: { language: "english" } }
 *   );
 *   if (called && loading) return <p>Loading ...</p>
 *   if (!called) {
 *     return <button onClick={() => loadGreeting()}>Load greeting</button>
 *   }
 *   return <h1>Hello {data.greeting.message}!</h1>;
 * }
 * ```
 * @since 3.0.0
 *
 * @param query - A GraphQL query document parsed into an AST by `gql`.
 * @param options - Default options to control how the query is executed.
 * @returns A tuple in the form of `[execute, result]`
 */
export function useLazyQuery<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: LazyQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
): LazyQueryResultTuple<TData, TVariables> {
  const execOptionsRef =
    React.useRef<Partial<LazyQueryHookExecOptions<TData, TVariables>>>(void 0);
  const optionsRef =
    React.useRef<LazyQueryHookOptions<TData, TVariables>>(void 0);
  const queryRef = React.useRef<
    DocumentNode | TypedDocumentNode<TData, TVariables>
  >(void 0);
  const merged = mergeOptions(options, execOptionsRef.current || {});
  const document = merged?.query ?? query;

  // Use refs to track options and the used query to ensure the `execute`
  // function remains referentially stable between renders.
  optionsRef.current = options;
  queryRef.current = document;

  const queryHookOptions = {
    ...merged,
    skip: !execOptionsRef.current,
  };
  const {
    obsQueryFields,
    result: useQueryResult,
    client,
    resultData,
    observable,
    onQueryExecuted,
  } = useQueryInternals(document, queryHookOptions);

  const initialFetchPolicy =
    observable.options.initialFetchPolicy ||
    client.defaultOptions.watchQuery?.fetchPolicy ||
    "cache-first";

  const forceUpdateState = React.useReducer((tick) => tick + 1, 0)[1];
  // We use useMemo here to make sure the eager methods have a stable identity.
  const eagerMethods = React.useMemo(() => {
    const eagerMethods: Record<string, any> = {};
    for (const key of EAGER_METHODS) {
      const method = obsQueryFields[key];
      eagerMethods[key] = function () {
        if (!execOptionsRef.current) {
          execOptionsRef.current = {};
          // Only the first time populating execOptionsRef.current matters here.
          forceUpdateState();
        }
        // @ts-expect-error this is just too generic to type
        return method.apply(this, arguments);
      };
    }

    return eagerMethods as typeof obsQueryFields;
  }, [forceUpdateState, obsQueryFields]);

  const called = !!execOptionsRef.current;
  const result = React.useMemo(
    () => ({
      ...useQueryResult,
      ...eagerMethods,
      called,
    }),
    [useQueryResult, eagerMethods, called]
  );

  const execute = React.useCallback<LazyQueryResultTuple<TData, TVariables>[0]>(
    (executeOptions) => {
      execOptionsRef.current =
        executeOptions ?
          {
            ...executeOptions,
            fetchPolicy: executeOptions.fetchPolicy || initialFetchPolicy,
          }
        : {
            fetchPolicy: initialFetchPolicy,
          };

      const options = mergeOptions(optionsRef.current, {
        query: queryRef.current,
        ...execOptionsRef.current,
      });

      const promise = executeQuery(
        resultData,
        observable,
        client,
        document,
        { ...options, skip: false },
        onQueryExecuted
      ).then((queryResult) => Object.assign(queryResult, eagerMethods));

      // Because the return value of `useLazyQuery` is usually floated, we need
      // to catch the promise to prevent unhandled rejections.
      promise.catch(() => {});

      return promise;
    },
    [
      client,
      document,
      eagerMethods,
      initialFetchPolicy,
      observable,
      resultData,
      onQueryExecuted,
    ]
  );

  const executeRef = React.useRef(execute);
  useIsomorphicLayoutEffect(() => {
    executeRef.current = execute;
  });

  const stableExecute = React.useCallback<typeof execute>(
    (...args) => executeRef.current(...args),
    []
  );
  return [stableExecute, result];
}

function executeQuery<TData, TVariables extends OperationVariables>(
  resultData: InternalResult<TData, TVariables>,
  observable: ObservableQuery<TData, TVariables>,
  client: ApolloClient<object>,
  currentQuery: DocumentNode,
  options: QueryHookOptions<TData, TVariables> & {
    query?: DocumentNode;
  },
  onQueryExecuted: (options: WatchQueryOptions<TVariables, TData>) => void
) {
  const query = options.query || currentQuery;
  const watchQueryOptions = createMakeWatchQueryOptions(
    client,
    query,
    options,
    false
  )(observable);

  const promise = observable.reobserve(
    getObsQueryOptions(observable, client, options, watchQueryOptions)
  );
  onQueryExecuted(watchQueryOptions);

  return promise.then(
    (result) =>
      toQueryResult(result, resultData.previousData, observable, client),
    () =>
      toQueryResult(
        observable.getCurrentResult(),
        resultData.previousData,
        observable,
        client
      )
  );
}
