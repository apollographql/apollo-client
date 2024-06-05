import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import * as React from "rehackt";

import type {
  ApolloClient,
  ApolloQueryResult,
  OperationVariables,
} from "../../core/index.js";
import { mergeOptions } from "../../utilities/index.js";
import type {
  LazyQueryHookExecOptions,
  LazyQueryHookOptions,
  LazyQueryResultTuple,
  NoInfer,
  QueryHookOptions,
  QueryResult,
} from "../types/types.js";
import type {
  InternalResult,
  ObsQueryWithMeta,
  UpdateInternalState,
} from "./useQuery.js";
import {
  createWatchQueryOptions,
  getDefaultFetchPolicy,
  getObsQueryOptions,
  lastWatchOptions,
  toQueryResult,
  useQueryWithInternalState,
} from "./useQuery.js";

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
    React.useRef<Partial<LazyQueryHookExecOptions<TData, TVariables>>>();
  const optionsRef = React.useRef<LazyQueryHookOptions<TData, TVariables>>();
  const queryRef = React.useRef<
    DocumentNode | TypedDocumentNode<TData, TVariables>
  >();
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
    updateInternalState,
  } = useQueryWithInternalState(document, queryHookOptions);

  const initialFetchPolicy =
    observable.options.initialFetchPolicy ||
    getDefaultFetchPolicy(
      queryHookOptions.defaultOptions,
      client.defaultOptions
    );

  const forceUpdateState = React.useReducer((tick) => tick + 1, 0)[1];
  // We use useMemo here to make sure the eager methods have a stable identity.
  const eagerMethods = React.useMemo(() => {
    const eagerMethods: Record<string, any> = {};
    for (const key of EAGER_METHODS) {
      const method = obsQueryFields[key];
      eagerMethods[key] = function () {
        if (!execOptionsRef.current) {
          execOptionsRef.current = Object.create(null);
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
        { ...options, skip: false },
        false,
        document,
        resultData,
        observable,
        client,
        updateInternalState
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
      updateInternalState,
    ]
  );

  const executeRef = React.useRef(execute);
  React.useLayoutEffect(() => {
    executeRef.current = execute;
  });

  const stableExecute = React.useCallback<typeof execute>(
    (...args) => executeRef.current(...args),
    []
  );
  return [stableExecute, result];
}

function executeQuery<TData, TVariables extends OperationVariables>(
  options: QueryHookOptions<TData, TVariables> & {
    query?: DocumentNode;
  },
  hasRenderPromises: boolean,
  currentQuery: DocumentNode,
  resultData: InternalResult<TData, TVariables>,
  observable: ObsQueryWithMeta<TData, TVariables>,
  client: ApolloClient<object>,
  updateInternalState: UpdateInternalState<TData, TVariables>
) {
  const query = options.query || currentQuery;
  const watchQueryOptions = createWatchQueryOptions(
    client,
    query,
    options,
    hasRenderPromises,
    observable
  );

  const concast = observable.reobserveAsConcast(
    getObsQueryOptions(client, options, watchQueryOptions, observable)
  );
  // this needs to be set to prevent an immediate `resubscribe` in the
  // next rerender of the `useQuery` internals
  observable[lastWatchOptions] = watchQueryOptions;
  updateInternalState({
    client,
    observable,
    // might be a different query
    query,
    resultData: Object.assign(resultData, {
      // Make sure getCurrentResult returns a fresh ApolloQueryResult<TData>,
      // but save the current data as this.previousData, just like setResult
      // usually does.
      previousData: resultData.current?.data || resultData.previousData,
      current: undefined,
    }),
  });

  return new Promise<
    Omit<QueryResult<TData, TVariables>, (typeof EAGER_METHODS)[number]>
  >((resolve) => {
    let result: ApolloQueryResult<TData>;

    // Subscribe to the concast independently of the ObservableQuery in case
    // the component gets unmounted before the promise resolves. This prevents
    // the concast from terminating early and resolving with `undefined` when
    // there are no more subscribers for the concast.
    concast.subscribe({
      next: (value) => {
        result = value;
      },
      error: () => {
        resolve(
          toQueryResult(
            observable.getCurrentResult(),
            resultData,
            observable,
            client
          )
        );
      },
      complete: () => {
        resolve(toQueryResult(result, resultData, observable, client));
      },
    });
  });
}
