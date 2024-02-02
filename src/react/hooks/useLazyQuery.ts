import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import * as React from "rehackt";

import type {
  OperationVariables,
  WatchQueryOptions,
} from "../../core/index.js";
import { mergeOptions } from "../../utilities/index.js";
import type {
  LazyQueryHookExecOptions,
  LazyQueryHookOptions,
  LazyQueryResultTuple,
  NoInfer,
  QueryResult,
} from "../types/types.js";
import { useInternalState } from "./useQuery.js";
import { useApolloClient } from "./useApolloClient.js";
import { useDeepMemo, useStableCallback } from "./internal/index.js";

// The following methods, when called will execute the query, regardless of
// whether the useLazyQuery execute function was called before.
const EAGER_METHODS = [
  "refetch",
  "reobserve",
  "fetchMore",
  "updateQuery",
  "startPolling",
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

  const skipPollAttempt = useStableCallback(() => {
    return options?.skipPollAttempt?.() ?? false;
  });

  // We need to define "stable" functions for each of the callback options so
  // that we can return an execute function that does not change identity
  // between renders from these callbacks alone. Its nicer DX to be able to just
  // pass a function to useLazyQuery without first having to wrap it in a
  // useCallback, but doing so means we either change identity on every render,
  // or we suffer from stale closures. `useStableCallback` gives us a stable
  // function that keeps it up to date with the latest props to avoid stale
  // closures.
  //
  // We have users that tend to call the execute function in a `useEffect`, and
  // we want to try and be good citizens by not causing unnecessary re-renders
  // in their components. In the event other options change, we are ok changing
  // the identity of the execute function.
  const onCompleted = useStableCallback(
    (
      ...args: Parameters<
        Extract<
          LazyQueryHookOptions<TData, TVariables>["onCompleted"],
          Function
        >
      >
    ) => {
      options?.onCompleted?.(...args);
    }
  );

  const onError = useStableCallback(
    (
      ...args: Parameters<
        Extract<LazyQueryHookOptions<TData, TVariables>["onError"], Function>
      >
    ) => {
      options?.onError?.(...args);
    }
  );

  const nextFetchPolicy = useStableCallback(function (
    this: WatchQueryOptions<TVariables, TData>,
    ...args: Parameters<
      Extract<
        LazyQueryHookOptions<TData, TVariables>["nextFetchPolicy"],
        Function
      >
    >
  ) {
    if (typeof options?.nextFetchPolicy === "function") {
      return options.nextFetchPolicy.apply(this, args);
    }

    return options?.nextFetchPolicy ?? args[0];
  });

  const stableOptions = useDeepMemo<LazyQueryHookOptions<TData, TVariables>>(
    () => ({
      ...options,
      skipPollAttempt,
      nextFetchPolicy,
      onCompleted,
      onError,
    }),
    [options, skipPollAttempt, nextFetchPolicy, onCompleted, onError]
  );

  const merged = mergeOptions(stableOptions, execOptionsRef.current || {});
  const document = merged?.query ?? query;

  const internalState = useInternalState<TData, TVariables>(
    useApolloClient(options && options.client),
    document
  );

  const useQueryResult = internalState.useQuery({
    ...merged,
    skip: !execOptionsRef.current,
  });

  const initialFetchPolicy =
    useQueryResult.observable.options.initialFetchPolicy ||
    internalState.getDefaultFetchPolicy();

  const result: QueryResult<TData, TVariables> = Object.assign(useQueryResult, {
    called: !!execOptionsRef.current,
  });

  // We use useMemo here to make sure the eager methods have a stable identity.
  const eagerMethods = React.useMemo(() => {
    const eagerMethods: Record<string, any> = {};
    for (const key of EAGER_METHODS) {
      const method = result[key];
      eagerMethods[key] = function () {
        if (!execOptionsRef.current) {
          execOptionsRef.current = Object.create(null);
          // Only the first time populating execOptionsRef.current matters here.
          internalState.forceUpdateState();
        }
        // @ts-expect-error this is just too generic to type
        return method.apply(this, arguments);
      };
    }

    return eagerMethods;
  }, []);

  Object.assign(result, eagerMethods);

  const execute = React.useCallback<LazyQueryResultTuple<TData, TVariables>[0]>(
    (executeOptions) => {
      execOptionsRef.current =
        executeOptions ?
          {
            ...executeOptions,
            fetchPolicy: executeOptions.fetchPolicy || initialFetchPolicy,
          }
        : { fetchPolicy: initialFetchPolicy };

      const options = mergeOptions(stableOptions, {
        query,
        ...execOptionsRef.current,
      });

      const promise = internalState
        .executeQuery({ ...options, skip: false })
        .then((queryResult) => Object.assign(queryResult, eagerMethods));

      // Because the return value of `useLazyQuery` is usually floated, we need
      // to catch the promise to prevent unhandled rejections.
      promise.catch(() => {});

      return promise;
    },
    [stableOptions, query, initialFetchPolicy]
  );

  return [execute, result];
}
