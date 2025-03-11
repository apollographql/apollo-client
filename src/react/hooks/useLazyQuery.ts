import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";
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
  SubscribeToMoreFunction,
  Unmasked,
  UpdateQueryMapFn,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "@apollo/client/core";
import { NetworkStatus } from "@apollo/client/core";
import type { NoInfer } from "@apollo/client/react";
import type {
  ObservableQueryFields,
  VariablesOption,
} from "@apollo/client/react";
import type { OnlyRequiredProperties } from "@apollo/client/utilities";
import { maybeDeepFreeze } from "@apollo/client/utilities";
import { invariant } from "@apollo/client/utilities/invariant";

import type { NextFetchPolicyContext } from "../../core/watchQueryOptions.js";

import { useRenderGuard } from "./internal/index.js";
import { useDeepMemo } from "./internal/useDeepMemo.js";
import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

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

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
  client?: ApolloClient<any>;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
}

export type LazyQueryHookExecOptions<
  TVariables extends OperationVariables = OperationVariables,
> = {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
} & VariablesOption<TVariables>;

export interface LazyQueryResult<TData, TVariables extends OperationVariables> {
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#startPolling:member} */
  startPolling: (pollInterval: number) => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#stopPolling:member} */
  stopPolling: () => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#subscribeToMore:member} */
  subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#updateQuery:member} */
  updateQuery: (mapFn: UpdateQueryMapFn<TData, TVariables>) => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#refetch:member} */
  refetch: (
    variables?: Partial<TVariables>
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
  ...args: [TVariables] extends [never] ?
    [options?: LazyQueryHookExecOptions<TVariables>]
  : Record<string, never> extends OnlyRequiredProperties<TVariables> ?
    [options?: LazyQueryHookExecOptions<TVariables>]
  : [options: LazyQueryHookExecOptions<TVariables>]
) => Promise<ApolloQueryResult<TData>>;

// The following methods, when called will execute the query, regardless of
// whether the useLazyQuery execute function was called before.
const EAGER_METHODS = [
  "refetch",
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
  const previousDataRef = React.useRef<TData>(undefined);
  const resultRef = React.useRef<ApolloQueryResult<TData>>(undefined);
  const stableOptions = useDeepMemo(() => options, [options]);
  const calledDuringRender = useRenderGuard();

  function createObservable() {
    return client.watchQuery({
      ...options,
      query,
      initialFetchPolicy: options?.fetchPolicy,
      fetchPolicy: "standby",
    });
  }

  const [currentClient, setCurrentClient] = React.useState(client);
  const [observable, setObservable] = React.useState(createObservable);

  if (currentClient !== client) {
    setCurrentClient(client);
    setObservable(createObservable());
  }

  // TODO: Revisit after we have RxJS in place. We should be able to use
  // observable.getCurrentResult() (or equivalent) to get these values which
  // will hopefully alleviate the need for us to use refs to track these values.
  const updateResult = React.useCallback(
    (result: ApolloQueryResult<TData>, forceUpdate: () => void) => {
      const previousData = resultRef.current?.data;

      if (previousData && !equal(previousData, result.data)) {
        // eslint-disable-next-line react-compiler/react-compiler
        previousDataRef.current = previousData;
      }

      resultRef.current = result;

      forceUpdate();
    },
    []
  );

  const observableResult = useSyncExternalStore(
    React.useCallback(
      (forceUpdate) => {
        const subscription = observable.subscribe((result) => {
          if (!equal(resultRef.current, result)) {
            updateResult(result, forceUpdate);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      },
      [observable, updateResult]
    ),
    () => resultRef.current || initialResult,
    () => initialResult
  );

  const forceUpdateState = React.useReducer((tick) => tick + 1, 0)[1];
  // We use useMemo here to make sure the eager methods have a stable identity.
  const eagerMethods = React.useMemo(() => {
    const eagerMethods: Record<string, any> = {};
    for (const key of EAGER_METHODS) {
      eagerMethods[key] = function () {
        invariant(
          resultRef.current,
          "useLazyQuery: '%s' cannot be called before executing the query.",
          key
        );

        // @ts-expect-error this is just to generic to type
        return observable[key].apply(observable, arguments);
      };
    }

    return eagerMethods as Pick<
      ObservableQueryFields<TData, TVariables>,
      (typeof EAGER_METHODS)[number]
    >;
  }, [observable]);

  React.useEffect(() => {
    const options: Partial<WatchQueryOptions<TVariables, TData>> = {
      query,
      errorPolicy: stableOptions?.errorPolicy,
      context: stableOptions?.context,
      refetchWritePolicy: stableOptions?.refetchWritePolicy,
      returnPartialData: stableOptions?.returnPartialData,
      notifyOnNetworkStatusChange: stableOptions?.notifyOnNetworkStatusChange,
    };

    // Wait to apply the changed fetch policy until after the execute
    // function has been called. The execute function will handle setting the
    // the fetch policy away from standby for us when called for the first time.
    if (
      observable.options.fetchPolicy !== "standby" &&
      stableOptions?.fetchPolicy
    ) {
      options.fetchPolicy = stableOptions?.fetchPolicy;
    }

    observable.silentSetOptions(options);
  }, [query, observable, stableOptions]);

  const execute: LazyQueryExecFunction<TData, TVariables> = React.useCallback(
    (...args) => {
      invariant(
        !calledDuringRender(),
        "useLazyQuery: 'execute' should not be called during render. To start a query during render, use the 'useQuery' hook."
      );

      const [executeOptions] = args;

      const options: Partial<WatchQueryOptions<TVariables, TData>> = {
        ...executeOptions,
        // TODO: Figure out a better way to reset variables back to empty
        variables: (executeOptions?.variables ?? {}) as TVariables,
      };

      if (observable.options.fetchPolicy === "standby") {
        options.fetchPolicy = observable.options.initialFetchPolicy;
      }

      const promise = observable.reobserve(options);

      // TODO: This should be fixed in core
      if (!resultRef.current && stableOptions?.notifyOnNetworkStatusChange) {
        updateResult(observable.getCurrentResult(), forceUpdateState);
      }

      return promise;
    },
    [
      observable,
      stableOptions,
      forceUpdateState,
      updateResult,
      calledDuringRender,
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

  return [stableExecute, result];
}

const initialResult: ApolloQueryResult<any> = maybeDeepFreeze({
  data: undefined,
  loading: false,
  networkStatus: NetworkStatus.ready,
  partial: true,
});
