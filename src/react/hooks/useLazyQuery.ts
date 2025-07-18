import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import * as React from "rehackt";

import type {
  ApolloClient,
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
  WatchQueryOptions,
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
import type { InternalResult } from "./useQuery.js";
import {
  createMakeWatchQueryOptions,
  getDefaultFetchPolicy,
  getObsQueryOptions,
  toQueryResult,
  useQueryInternals,
} from "./useQuery.js";
import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import { useWarnRemovedOption } from "./internal/useWarnRemovedOption.js";
import { invariant } from "../../utilities/globals/invariantWrappers.js";
import { warnRemovedOption } from "../../utilities/deprecation/index.js";
import { useRenderGuard } from "./internal/index.js";

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

const REMOVED_EXECUTE_OPTIONS = [
  "initialFetchPolicy",
  "onCompleted",
  "onError",
  "defaultOptions",
  "partialRefetch",
  "canonizeResults",
] as const satisfies Array<keyof LazyQueryHookExecOptions>;

const DEPRECATED_EXECUTE_OPTIONS = [
  "query",
  "ssr",
  "client",
  "fetchPolicy",
  "nextFetchPolicy",
  "refetchWritePolicy",
  "errorPolicy",
  "pollInterval",
  "notifyOnNetworkStatusChange",
  "returnPartialData",
  "skipPollAttempt",
] as const satisfies Array<
  Exclude<
    keyof LazyQueryHookExecOptions,
    (typeof REMOVED_EXECUTE_OPTIONS)[number]
  >
>;

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
  if (__DEV__) {
    /* eslint-disable react-hooks/rules-of-hooks, react-compiler/react-compiler */
    const warnOpts = options || {};

    useWarnRemovedOption(warnOpts, "canonizeResults", "useLazyQuery");
    useWarnRemovedOption(
      warnOpts,
      "variables",
      "useLazyQuery",
      "Pass all `variables` to the returned `execute` function instead."
    );
    useWarnRemovedOption(
      warnOpts,
      "context",
      "useLazyQuery",
      "Pass `context` to the returned `execute` function instead."
    );
    useWarnRemovedOption(
      warnOpts,
      "onCompleted",
      "useLazyQuery",
      "If your `onCompleted` callback sets local state, switch to use derived state using `data` returned from the hook instead. Use `useEffect` to perform side-effects as a result of updates to `data`."
    );
    useWarnRemovedOption(
      warnOpts,
      "onError",
      "useLazyQuery",
      "If your `onError` callback sets local state, switch to use derived state using `data`, `error` or `errors` returned from the hook instead. Use `useEffect` if you need to perform side-effects as a result of updates to `data`, `error` or `errors`."
    );
    useWarnRemovedOption(
      warnOpts,
      "defaultOptions",
      "useLazyQuery",
      "Pass the options directly to the hook instead."
    );
    useWarnRemovedOption(
      warnOpts,
      "initialFetchPolicy",
      "useLazyQuery",
      "Use the `fetchPolicy` option instead."
    );

    useWarnRemovedOption(warnOpts, "partialRefetch", "useLazyQuery");
    /* eslint-enable react-hooks/rules-of-hooks, react-compiler/react-compiler */
  }

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
        if (__DEV__) {
          if (key === "reobserve") {
            invariant.warn(
              "[useLazyQuery]: `reobserve` is deprecated and will removed in Apollo Client 4.0. Please change options by rerendering `useLazyQuery` with new options."
            );
          }
        }

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

  const calledDuringRender = useRenderGuard();
  const warnRef = React.useRef(new Set<keyof LazyQueryHookExecOptions>());

  const execute = React.useCallback<LazyQueryResultTuple<TData, TVariables>[0]>(
    (executeOptions) => {
      if (__DEV__) {
        if (calledDuringRender()) {
          invariant.warn(
            "[useLazyQuery]: Calling `execute` in render will throw in Apollo Client 4.0. Either switch to `useQuery` to run the query during render or move the `execute` call inside of `useEffect`."
          );
        }

        for (const name of REMOVED_EXECUTE_OPTIONS) {
          if (!warnRef.current.has(name)) {
            warnRemovedOption(
              executeOptions || {},
              name,
              "useLazyQuery.execute"
            );
            warnRef.current.add(name);
          }
        }

        for (const name of DEPRECATED_EXECUTE_OPTIONS) {
          if (!warnRef.current.has(name)) {
            warnRemovedOption(
              executeOptions || {},
              name,
              "useLazyQuery.execute",
              "Please pass the option to the `useLazyQuery` hook instead."
            );
            warnRef.current.add(name);
          }
        }
      }

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
      calledDuringRender,
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

  const concast = observable.reobserveAsConcast(
    getObsQueryOptions(observable, client, options, watchQueryOptions)
  );
  onQueryExecuted(watchQueryOptions);

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
            resultData.previousData,
            observable,
            client
          )
        );
      },
      complete: () => {
        resolve(
          toQueryResult(
            observable["maskResult"](result),
            resultData.previousData,
            observable,
            client
          )
        );
      },
    });
  });
}
