import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { equal } from "@wry/equality";
import type { DocumentNode, GraphQLFormattedError } from "graphql";
import * as React from "rehackt";

import type {
  ApolloClient,
  ApolloError,
  ApolloQueryResult,
  DefaultContext,
  ErrorPolicy,
  FetchMoreQueryOptions,
  MaybeMasked,
  ObservableQuery,
  OperationVariables,
  RefetchWritePolicy,
  SubscribeToMoreOptions,
  Unmasked,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "@apollo/client/core";
import { NetworkStatus } from "@apollo/client/core";
import type { NoInfer } from "@apollo/client/react";
import { maybeDeepFreeze } from "@apollo/client/utilities";

import type { NextFetchPolicyContext } from "../../core/watchQueryOptions.js";
import type { ObservableQueryFields } from "../types/types.js";

import { useDeepMemo } from "./internal/useDeepMemo.js";
import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

const {
  prototype: { hasOwnProperty },
} = Object;

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
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: TVariables;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
}

export interface LazyQueryResult<TData, TVariables extends OperationVariables> {
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#startPolling:member} */
  startPolling: (pollInterval: number) => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#stopPolling:member} */
  stopPolling: () => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#subscribeToMore:member} */
  subscribeToMore: <
    TSubscriptionData = TData,
    TSubscriptionVariables extends OperationVariables = TVariables,
  >(
    options: SubscribeToMoreOptions<
      TData,
      TSubscriptionVariables,
      TSubscriptionData
    >
  ) => () => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#updateQuery:member} */
  updateQuery: <TVars extends OperationVariables = TVariables>(
    mapFn: (
      previousQueryResult: Unmasked<TData>,
      options: Pick<WatchQueryOptions<TVars, TData>, "variables">
    ) => Unmasked<TData>
  ) => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#refetch:member} */
  refetch: (
    variables?: Partial<TVariables>
  ) => Promise<ApolloQueryResult<MaybeMasked<TData>>>;
  /** @internal */
  reobserve: (
    newOptions?: Partial<WatchQueryOptions<TVariables, TData>>,
    newNetworkStatus?: NetworkStatus
  ) => Promise<ApolloQueryResult<MaybeMasked<TData>>>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#variables:member} */
  variables: TVariables | undefined;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#fetchMore:member} */
  fetchMore: <
    TFetchData = TData,
    TFetchVars extends OperationVariables = TVariables,
  >(
    fetchMoreOptions: FetchMoreQueryOptions<TFetchVars, TFetchData> & {
      updateQuery?: (
        previousQueryResult: Unmasked<TData>,
        options: {
          fetchMoreResult: Unmasked<TFetchData>;
          variables: TFetchVars;
        }
      ) => Unmasked<TData>;
    }
  ) => Promise<ApolloQueryResult<MaybeMasked<TFetchData>>>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#client:member} */
  client: ApolloClient<any>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#observable:member} */
  observable: ObservableQuery<TData, TVariables>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
  data: MaybeMasked<TData> | undefined;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#previousData:member} */
  previousData?: MaybeMasked<TData>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#error:member} */
  error?: ApolloError;
  /**
   * @deprecated This property will be removed in a future version of Apollo Client.
   * Please use `error.graphQLErrors` instead.
   */
  errors?: ReadonlyArray<GraphQLFormattedError>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#loading:member} */
  loading: boolean;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#networkStatus:member} */
  networkStatus: NetworkStatus;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#called:member} */
  called: boolean;
}

export type LazyQueryResultTuple<
  TData,
  TVariables extends OperationVariables,
> = [
  execute: LazyQueryExecFunction<TData, TVariables>,
  result: LazyQueryResult<TData, TVariables>,
];

export type LazyQueryExecFunction<
  TData,
  TVariables extends OperationVariables,
> = (
  options?: LazyQueryHookExecOptions<TVariables>
) => Promise<LazyQueryResult<TData, TVariables>>;

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
  const client = useApolloClient(options?.client);
  const [currentClient, setCurrentClient] = React.useState(client);
  const [observable, setObservable] = React.useState(() =>
    client.watchQuery({ ...options, query, fetchPolicy: "standby" })
  );

  const dirtyRef = React.useRef(false);
  const previousDataRef = React.useRef<TData>(undefined);
  const resultRef = React.useRef<ApolloQueryResult<TData>>(undefined);
  const stableOptions = useDeepMemo(() => options, [options]);

  if (currentClient !== client) {
    setCurrentClient(client);
    setObservable(
      client.watchQuery({ ...options, query, fetchPolicy: "standby" })
    );
    dirtyRef.current = true;
  }

  function updateResult(result: ApolloQueryResult<TData>) {
    const previousData = resultRef.current?.data;

    if (previousData) {
      previousDataRef.current = previousData;
    }

    resultRef.current = result;
  }

  const observableResult = useSyncExternalStore(
    React.useCallback(
      (forceUpdate) => {
        function handleNext(result: ApolloQueryResult<TData>) {
          if (!equal(resultRef.current, result)) {
            updateResult(result);
            forceUpdate();
          }
        }

        function handleError(error: unknown) {
          subscription.current.unsubscribe();
          subscription.current = observable.resubscribeAfterError(
            handleNext,
            handleError
          );

          if (!hasOwnProperty.call(error, "graphQLErrors")) {
            // The error is not a GraphQL error
            throw error;
          }

          const previousResult = resultRef.current;
          if (!previousResult || !equal(error, previousResult.error)) {
            updateResult({
              data: previousResult?.data,
              partial: !previousResult?.data,
              ...resultRef.current,
              error: error as ApolloError,
              loading: false,
              networkStatus: NetworkStatus.error,
            });
            forceUpdate();
          }
        }

        const subscription = {
          current: observable.subscribe({
            next: handleNext,
            error: handleError,
          }),
        };

        return () => {
          subscription.current.unsubscribe();
        };
      },
      [observable]
    ),
    () => resultRef.current || initialResult,
    () => resultRef.current || initialResult
  );

  const execOptionsRef =
    React.useRef<Partial<LazyQueryHookExecOptions<TVariables>>>(void 0);

  const obsQueryFields = React.useMemo<
    Omit<ObservableQueryFields<TData, TVariables>, "variables">
  >(() => bindObservableMethods(observable), [observable]);

  const fetchPolicy =
    options?.fetchPolicy ||
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
          // forceUpdateState();
        }
        // @ts-expect-error this is just too generic to type
        return method.apply(this, arguments);
      };
    }

    return eagerMethods as typeof obsQueryFields;
  }, [forceUpdateState, obsQueryFields]);

  React.useEffect(() => {
    observable.silentSetOptions({
      errorPolicy: stableOptions?.errorPolicy,
      context: stableOptions?.context,
      refetchWritePolicy: stableOptions?.refetchWritePolicy,
      returnPartialData: stableOptions?.returnPartialData,
    });
  }, [observable, stableOptions]);

  const result = React.useMemo(
    () => ({
      ...eagerMethods,
      ...observableResult,
      client,
      previousData: previousDataRef.current,
      variables: observable.variables,
      observable,
      called: !!resultRef.current,
    }),
    [client, observableResult, eagerMethods, observable]
  );

  const execute = React.useCallback<LazyQueryExecFunction<TData, TVariables>>(
    async (executeOptions) => {
      const previousQuery = observable.options.query;
      const previousVariables = observable.variables;

      const concast = observable.reobserveAsConcast({
        ...executeOptions,
        // TODO: Figure out a better way to reset variables back to empty
        variables: executeOptions?.variables ?? ({} as TVariables),
        query,
        fetchPolicy,
      });

      // Call updateResult after calling reobserve due to the timing of
      // rerendering in React 17. Without this, the `variables` value is returned
      // with the previous set of variables.
      if (
        !resultRef.current ||
        dirtyRef.current ||
        !equal(
          { query: previousQuery, variables: previousVariables },
          // TODO: Remove fallback on empty object when variables returns
          // undefined
          { query, variables: executeOptions?.variables ?? {} }
        )
      ) {
        dirtyRef.current = false;
        updateResult(observable.getCurrentResult());
        forceUpdateState();
      }

      return new Promise<LazyQueryResult<TData, TVariables>>(
        (resolve, reject) => {
          let result: ApolloQueryResult<TData>;

          // Subscribe to the concast independently of the ObservableQuery in case
          // the component gets unmounted before the promise resolves. This prevents
          // the concast from terminating early and resolving with `undefined` when
          // there are no more subscribers for the concast.
          concast.subscribe({
            next(value) {
              result = value;
            },
            complete() {
              resolve({
                ...observable["maskResult"](result),
                ...eagerMethods,
                client,
                observable,
                called: true,
                previousData: previousDataRef.current,
                variables: observable.variables,
              });
            },
            error: reject,
          });
        }
      );
    },
    [query, eagerMethods, fetchPolicy, observable, stableOptions]
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

const initialResult: ApolloQueryResult<any> = maybeDeepFreeze({
  data: undefined,
  loading: false,
  networkStatus: NetworkStatus.ready,
  partial: true,
});

function bindObservableMethods<TData, TVariables extends OperationVariables>(
  observable: ObservableQuery<TData, TVariables>
) {
  return {
    refetch: observable.refetch.bind(observable),
    reobserve: observable.reobserve.bind(observable),
    fetchMore: observable.fetchMore.bind(observable),
    updateQuery: observable.updateQuery.bind(observable),
    startPolling: observable.startPolling.bind(observable),
    stopPolling: observable.stopPolling.bind(observable),
    subscribeToMore: observable.subscribeToMore.bind(observable),
  };
}
