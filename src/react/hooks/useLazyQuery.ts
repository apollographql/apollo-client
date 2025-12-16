import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";
import * as React from "react";

import type {
  ApolloClient,
  DataState,
  DefaultContext,
  ErrorLike,
  ErrorPolicy,
  GetDataState,
  InternalTypes,
  MaybeMasked,
  ObservableQuery,
  OperationVariables,
  RefetchWritePolicy,
  SubscribeToMoreFunction,
  UpdateQueryMapFn,
  WatchQueryFetchPolicy,
} from "@apollo/client";
import { NetworkStatus } from "@apollo/client";
import type {
  DocumentationTypes as UtilityDocumentationTypes,
  NoInfer,
  VariablesOption,
} from "@apollo/client/utilities/internal";
import {
  maybeDeepFreeze,
  variablesUnknownSymbol,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { useRenderGuard } from "./internal/index.js";
import { useDeepMemo } from "./internal/useDeepMemo.js";
import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
export declare namespace useLazyQuery {
  import _self = useLazyQuery;
  export interface Options<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: WatchQueryFetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#nextFetchPolicy:member} */
    nextFetchPolicy?:
      | WatchQueryFetchPolicy
      | ((
          this: ApolloClient.WatchQueryOptions<TData, TVariables>,
          currentFetchPolicy: WatchQueryFetchPolicy,
          context: InternalTypes.NextFetchPolicyContext<TData, TVariables>
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

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skipPollAttempt:member} */
    skipPollAttempt?: () => boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
    client?: ApolloClient;
  }
  namespace DocumentationTypes {
    namespace useLazyQuery {
      export interface Options<
        TData = unknown,
        TVariables extends OperationVariables = OperationVariables,
      > extends _self.Options<TData, TVariables> {}
    }
  }

  namespace Base {
    export interface Result<TData, TVariables extends OperationVariables> {
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
      ) => Promise<ApolloClient.QueryResult<MaybeMasked<TData>>>;

      /** {@inheritDoc @apollo/client!QueryResultDocumentation#fetchMore:member} */
      fetchMore: <
        TFetchData = TData,
        TFetchVars extends OperationVariables = TVariables,
      >(
        fetchMoreOptions: ObservableQuery.FetchMoreOptions<
          TData,
          TVariables,
          TFetchData,
          TFetchVars
        >
      ) => Promise<ApolloClient.QueryResult<MaybeMasked<TFetchData>>>;

      /** {@inheritDoc @apollo/client!QueryResultDocumentation#client:member} */
      client: ApolloClient;

      /** {@inheritDoc @apollo/client!QueryResultDocumentation#observable:member} */
      observable: ObservableQuery<TData, TVariables>;

      /** {@inheritDoc @apollo/client!QueryResultDocumentation#previousData:member} */
      previousData?: MaybeMasked<TData>;

      /** {@inheritDoc @apollo/client!QueryResultDocumentation#error:member} */
      error?: ErrorLike;

      /** {@inheritDoc @apollo/client!QueryResultDocumentation#loading:member} */
      loading: boolean;

      /** {@inheritDoc @apollo/client!QueryResultDocumentation#networkStatus:member} */
      networkStatus: NetworkStatus;
    }
  }

  export type Result<
    TData,
    TVariables extends OperationVariables,
    TStates extends
      DataState<TData>["dataState"] = DataState<TData>["dataState"],
  > = Base.Result<TData, TVariables> &
    (
      | ({
          /**
           * If `true`, the associated lazy query has been executed.
           *
           * @docGroup 2. Network info
           */
          called: true;

          /** {@inheritDoc @apollo/client!QueryResultDocumentation#variables:member} */
          variables: TVariables;
        } & GetDataState<MaybeMasked<TData>, TStates>)
      | {
          /**
           * If `true`, the associated lazy query has been executed.
           *
           * @docGroup 2. Network info
           */
          called: false;

          /** {@inheritDoc @apollo/client!QueryResultDocumentation#variables:member} */
          variables: Partial<TVariables>;

          /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
          data: undefined;
          /** {@inheritDoc @apollo/client!QueryResultDocumentation#dataState:member} */
          dataState: "empty";
        }
    );

  namespace DocumentationTypes {
    namespace useLazyQuery {
      export interface Result<TData, TVariables extends OperationVariables>
        extends Base.Result<TData, TVariables>,
          UtilityDocumentationTypes.DataState<TData>,
          UtilityDocumentationTypes.VariableOptions<TVariables> {
        /**
         * If `true`, the associated lazy query has been executed.
         *
         * @docGroup 2. Network info
         */
        called: boolean;
      }
    }
  }

  export type ExecOptions<
    TVariables extends OperationVariables = OperationVariables,
  > = {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
    context?: DefaultContext;
  } & VariablesOption<TVariables>;

  namespace DocumentationTypes {
    namespace useLazyQuery {
      export interface ExecOptions<TVariables extends OperationVariables>
        extends UtilityDocumentationTypes.VariableOptions<TVariables> {
        /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
        context?: DefaultContext;
      }
    }
  }

  export type ResultTuple<
    TData,
    TVariables extends OperationVariables,
    TStates extends
      DataState<TData>["dataState"] = DataState<TData>["dataState"],
  > = [
    execute: ExecFunction<TData, TVariables>,
    result: useLazyQuery.Result<TData, TVariables, TStates>,
  ];

  export type ExecFunction<TData, TVariables extends OperationVariables> = (
    ...args: {} extends TVariables ?
      [options?: useLazyQuery.ExecOptions<TVariables>]
    : [options: useLazyQuery.ExecOptions<TVariables>]
  ) => ObservableQuery.ResultPromise<ApolloClient.QueryResult<TData>>;

  namespace DocumentationTypes {
    namespace useLazyQuery {
      export import ResultTuple = _self.ResultTuple;
    }
  }

  namespace DocumentationTypes {
    /** {@inheritDoc @apollo/client/react!useLazyQuery:function(1)} */
    export function useLazyQuery<
      TData = unknown,
      TVariables extends OperationVariables = OperationVariables,
    >(
      query: DocumentNode | TypedDocumentNode<TData, TVariables>,
      options: useLazyQuery.Options<TData, TVariables>
    ): useLazyQuery.ResultTuple<TData, TVariables>;
  }
}

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
 *
 * ```jsx
 * import { gql } from "@apollo/client";
 * import { useLazyQuery } from "@apollo/client/react";
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
 *   const [loadGreeting, { called, loading, data }] = useLazyQuery(GET_GREETING, {
 *     variables: { language: "english" },
 *   });
 *   if (called && loading) return <p>Loading ...</p>;
 *   if (!called) {
 *     return <button onClick={() => loadGreeting()}>Load greeting</button>;
 *   }
 *   return <h1>Hello {data.greeting.message}!</h1>;
 * }
 * ```
 *
 * @param query - A GraphQL query document parsed into an AST by `gql`.
 * @param options - Default options to control how the query is executed.
 * @returns A tuple in the form of `[execute, result]`
 */
export function useLazyQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useLazyQuery.Options<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
  }
): useLazyQuery.ResultTuple<
  TData,
  TVariables,
  "empty" | "complete" | "streaming" | "partial"
>;

/** {@inheritDoc @apollo/client/react!useLazyQuery:function(1)} */
export function useLazyQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useLazyQuery.Options<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: boolean;
  }
): useLazyQuery.ResultTuple<
  TData,
  TVariables,
  "empty" | "complete" | "streaming" | "partial"
>;

/** {@inheritDoc @apollo/client/react!useLazyQuery:function(1)} */
export function useLazyQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: useLazyQuery.Options<NoInfer<TData>, NoInfer<TVariables>>
): useLazyQuery.ResultTuple<
  TData,
  TVariables,
  "empty" | "complete" | "streaming"
>;

export function useLazyQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TStates extends DataState<TData>["dataState"] = DataState<TData>["dataState"],
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: useLazyQuery.Options<NoInfer<TData>, NoInfer<TVariables>>
): useLazyQuery.ResultTuple<TData, TVariables, TStates> {
  const client = useApolloClient(options?.client);
  const previousDataRef = React.useRef<TData>(undefined);
  const resultRef = React.useRef<ObservableQuery.Result<TData>>(undefined);
  const stableOptions = useDeepMemo(() => options, [options]);
  const calledDuringRender = useRenderGuard();

  function createObservable() {
    return client.watchQuery({
      ...options,
      query,
      initialFetchPolicy: options?.fetchPolicy,
      fetchPolicy: "standby",
      [variablesUnknownSymbol]: true,
    } as ApolloClient.WatchQueryOptions<TData, TVariables>);
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
    (result: ObservableQuery.Result<TData>, forceUpdate: () => void) => {
      const previousData = resultRef.current?.data;

      if (previousData && !equal(previousData, result.data)) {
        previousDataRef.current = previousData as TData;
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

  // We use useMemo here to make sure the eager methods have a stable identity.
  const eagerMethods = React.useMemo(() => {
    const eagerMethods: Record<string, any> = {};
    for (const key of EAGER_METHODS) {
      eagerMethods[key] = function (...args: any[]) {
        invariant(
          resultRef.current,
          "useLazyQuery: '%s' cannot be called before executing the query.",
          key
        );

        // @ts-expect-error this is just to generic to type
        return observable[key](...args);
      };
    }

    return eagerMethods as Pick<
      useLazyQuery.Result<TData, TVariables>,
      (typeof EAGER_METHODS)[number]
    >;
  }, [observable]);

  React.useEffect(() => {
    const updatedOptions: Partial<ObservableQuery.Options<TData, TVariables>> =
      {
        query,
        errorPolicy: stableOptions?.errorPolicy,
        refetchWritePolicy: stableOptions?.refetchWritePolicy,
        returnPartialData: stableOptions?.returnPartialData,
        notifyOnNetworkStatusChange: stableOptions?.notifyOnNetworkStatusChange,
        nextFetchPolicy: options?.nextFetchPolicy,
        skipPollAttempt: options?.skipPollAttempt,
      };

    // Wait to apply the changed fetch policy until after the execute
    // function has been called. The execute function will handle setting the
    // the fetch policy away from standby for us when called for the first time.
    if (
      observable.options.fetchPolicy !== "standby" &&
      stableOptions?.fetchPolicy
    ) {
      updatedOptions.fetchPolicy = stableOptions.fetchPolicy;
    }

    observable.applyOptions(updatedOptions);
  }, [
    query,
    observable,
    stableOptions,
    // Ensure inline functions don't suffer from stale closures by checking for
    // these deps separately. @wry/equality doesn't compare function identity
    // so `stableOptions` isn't updated when using inline functions.
    options?.nextFetchPolicy,
    options?.skipPollAttempt,
  ]);

  const execute: useLazyQuery.ExecFunction<TData, TVariables> =
    React.useCallback(
      (...args) => {
        invariant(
          !calledDuringRender(),
          "useLazyQuery: 'execute' should not be called during render. To start a query during render, use the 'useQuery' hook."
        );

        const [executeOptions] = args;

        let fetchPolicy = observable.options.fetchPolicy;

        if (fetchPolicy === "standby") {
          fetchPolicy = observable.options.initialFetchPolicy;
        }

        return observable.reobserve({
          fetchPolicy,
          // If `variables` is not given, reset back to empty variables by
          // ensuring the key exists in options
          variables: executeOptions?.variables,
          context: executeOptions?.context ?? {},
        });
      },
      [observable, calledDuringRender]
    );

  const executeRef = React.useRef(execute);
  useIsomorphicLayoutEffect(() => {
    executeRef.current = execute;
  });

  const stableExecute = React.useCallback<typeof execute>(
    (...args) => executeRef.current(...args),
    []
  );

  const result = React.useMemo(() => {
    const { partial, ...result } = observableResult;

    return {
      ...eagerMethods,
      ...result,
      client,
      previousData: previousDataRef.current,
      variables: observable.variables,
      observable,
      called: !!resultRef.current,
    };
  }, [client, observableResult, eagerMethods, observable]);

  return [stableExecute, result as any];
}

const initialResult: ObservableQuery.Result<any> = maybeDeepFreeze({
  data: undefined,
  dataState: "empty",
  loading: false,
  networkStatus: NetworkStatus.ready,
  partial: true,
});
