/**
 * Function parameters in this file try to follow a common order for the sake of
 * readability and consistency. The order is as follows:
 *
 * resultData
 * observable
 * client
 * query
 * options
 * watchQueryOptions
 * makeWatchQueryOptions
 */
/**  */
import { equal } from "@wry/equality";
import * as React from "react";
import { asapScheduler, observeOn } from "rxjs";

import type {
  DataState,
  DefaultContext,
  DocumentNode,
  ErrorLike,
  ErrorPolicy,
  GetDataState,
  InternalTypes,
  ObservableQuery,
  OperationVariables,
  RefetchWritePolicy,
  SubscribeToMoreFunction,
  TypedDocumentNode,
  UpdateQueryMapFn,
  WatchQueryFetchPolicy,
} from "@apollo/client";
import type { ApolloClient } from "@apollo/client";
import { NetworkStatus } from "@apollo/client";
import type { MaybeMasked } from "@apollo/client/masking";
import type {
  DocumentationTypes as UtilityDocumentationTypes,
  NoInfer,
  VariablesOption,
} from "@apollo/client/utilities/internal";
import {
  maybeDeepFreeze,
  mergeOptions,
  variablesUnknownSymbol,
} from "@apollo/client/utilities/internal";

import type { SkipToken } from "./constants.js";
import { skipToken } from "./constants.js";
import { useDeepMemo, wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

export declare namespace useQuery {
  import _self = useQuery;
  export namespace Base {
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

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skipPollAttempt:member} */
      skipPollAttempt?: () => boolean;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#ssr:member} */
      ssr?: boolean;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
      client?: ApolloClient;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
      context?: DefaultContext;

      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skip:member} */
      skip?: boolean;
    }
  }
  export type Options<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = Base.Options<TData, TVariables> & VariablesOption<TVariables>;

  export namespace DocumentationTypes {
    namespace useQuery {
      export interface Options<
        TData = unknown,
        TVariables extends OperationVariables = OperationVariables,
      > extends Base.Options<TData, TVariables>,
          UtilityDocumentationTypes.VariableOptions<TVariables> {}
    }
  }

  export namespace Base {
    export interface Result<
      TData = unknown,
      TVariables extends OperationVariables = OperationVariables,
      TReturnVariables extends OperationVariables = TVariables,
    > {
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

      /** {@inheritDoc @apollo/client!QueryResultDocumentation#variables:member} */
      variables: TReturnVariables;

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
    }
  }
  export type Result<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
    TStates extends
      DataState<TData>["dataState"] = DataState<TData>["dataState"],
    TReturnVariables extends OperationVariables = TVariables,
  > = Base.Result<TData, TVariables, TReturnVariables> &
    GetDataState<MaybeMasked<TData>, TStates>;

  export namespace DocumentationTypes {
    namespace useQuery {
      export interface Result<
        TData = unknown,
        TVariables extends OperationVariables = OperationVariables,
      > extends Base.Result<TData, TVariables>,
          UtilityDocumentationTypes.DataState<TData> {}
    }
  }

  export namespace DocumentationTypes {
    /** {@inheritDoc @apollo/client/react!useQuery:function(1)} */
    export function useQuery<
      TData = unknown,
      TVariables extends OperationVariables = OperationVariables,
    >(
      query: DocumentNode | TypedDocumentNode<TData, TVariables>,
      options: useQuery.Options<TData, TVariables>
    ): useQuery.Result<TData, TVariables>;
  }
}

const lastWatchOptions = Symbol();

interface ObsQueryWithMeta<TData, TVariables extends OperationVariables>
  extends ObservableQuery<TData, TVariables> {
  [lastWatchOptions]?: Readonly<
    ApolloClient.WatchQueryOptions<TData, TVariables>
  >;
}

interface InternalResult<TData> {
  // These members are populated by getCurrentResult and setResult, and it's
  // okay/normal for them to be initially undefined.
  current: ObservableQuery.Result<TData>;
  previousData?: undefined | MaybeMasked<TData>;

  // Track current variables separately in case a call to e.g. `refetch(newVars)`
  // causes an emit that is deeply equal to the current result. This lets us
  // compare if we should force rerender due to changed variables
  variables: OperationVariables;
}

interface InternalState<TData, TVariables extends OperationVariables> {
  client: ReturnType<typeof useApolloClient>;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  observable: ObsQueryWithMeta<TData, TVariables>;
  resultData: InternalResult<TData>;
}

/**
 * A hook for executing queries in an Apollo application.
 *
 * To run a query within a React component, call `useQuery` and pass it a GraphQL query document.
 *
 * When your component renders, `useQuery` returns an object from Apollo Client that contains `loading`, `error`, `dataState`, and `data` properties you can use to render your UI.
 *
 * > Refer to the [Queries](https://www.apollographql.com/docs/react/data/queries) section for a more in-depth overview of `useQuery`.
 *
 * @example
 *
 * ```jsx
 * import { gql } from "@apollo/client";
 * import { useQuery } from "@apollo/client/react";
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
 *   const { loading, error, data } = useQuery(GET_GREETING, {
 *     variables: { language: "english" },
 *   });
 *   if (loading) return <p>Loading ...</p>;
 *   return <h1>Hello {data.greeting.message}!</h1>;
 * }
 * ```
 *
 * @param query - A GraphQL query document parsed into an AST by `gql`.
 * @param options - Options to control how the query is executed.
 * @returns Query result object
 */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
  }
): useQuery.Result<
  TData,
  TVariables,
  "empty" | "complete" | "streaming" | "partial"
>;

/** {@inheritDoc @apollo/client/react!useQuery:function(1)} */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken
): useQuery.Result<TData, TVariables, "empty", Record<string, never>>;

/** {@inheritDoc @apollo/client/react!useQuery:function(1)} */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (useQuery.Options<NoInfer<TData>, NoInfer<TVariables>> & {
        returnPartialData: true;
      })
): useQuery.Result<
  TData,
  TVariables,
  "empty" | "complete" | "streaming" | "partial",
  Partial<TVariables>
>;

/** {@inheritDoc @apollo/client/react!useQuery:function(1)} */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: boolean;
  }
): useQuery.Result<
  TData,
  TVariables,
  "empty" | "complete" | "streaming" | "partial"
>;

/** {@inheritDoc @apollo/client/react!useQuery:function(1)} */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (useQuery.Options<NoInfer<TData>, NoInfer<TVariables>> & {
        returnPartialData: boolean;
      })
): useQuery.Result<
  TData,
  TVariables,
  "empty" | "complete" | "streaming" | "partial",
  Partial<TVariables>
>;

/** {@inheritDoc @apollo/client/react!useQuery:function(1)} */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [options?: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>]
  : [options: useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>]
): useQuery.Result<TData, TVariables, "empty" | "complete" | "streaming">;

/** {@inheritDoc @apollo/client/react!useQuery:function(1)} */
export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [
      options?:
        | SkipToken
        | useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>,
    ]
  : [options: SkipToken | useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>]
): useQuery.Result<
  TData,
  TVariables,
  "empty" | "complete" | "streaming",
  Partial<TVariables>
>;

export function useQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [
      options?:
        | SkipToken
        | useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>,
    ]
  : [options: SkipToken | useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>]
): useQuery.Result<TData, TVariables> {
  "use no memo";
  return wrapHook(
    "useQuery",
    // eslint-disable-next-line react-compiler/react-compiler
    useQuery_,
    useApolloClient(typeof options === "object" ? options.client : undefined)
  )(query, options);
}

function useQuery_<TData, TVariables extends OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | useQuery.Options<
        NoInfer<TData>,
        NoInfer<TVariables>
      > = {} as useQuery.Options<TData, TVariables>
): useQuery.Result<TData, TVariables> {
  const client = useApolloClient(
    typeof options === "object" ? options.client : undefined
  );
  const { ssr } = typeof options === "object" ? options : {};

  const watchQueryOptions = useOptions(
    query,
    options,
    client.defaultOptions.watchQuery
  );

  function createState(
    previous?: InternalState<TData, TVariables>
  ): InternalState<TData, TVariables> {
    const observable = client.watchQuery(watchQueryOptions);

    return {
      client,
      query,
      observable,
      resultData: {
        current: observable.getCurrentResult(),
        // Reuse previousData from previous InternalState (if any) to provide
        // continuity of previousData even if/when the query or client changes.
        previousData: previous?.resultData.current.data as TData,
        variables: observable.variables,
      },
    };
  }

  let [state, setState] = React.useState(createState);

  if (client !== state.client || query !== state.query) {
    // If the client or query have changed, we need to create a new InternalState.
    // This will trigger a re-render with the new state, but it will also continue
    // to run the current render function to completion.
    // Since we sometimes trigger some side-effects in the render function, we
    // re-assign `state` to the new state to ensure that those side-effects are
    // triggered with the new state.
    setState((state = createState(state)));
  }

  const { observable, resultData } = state;

  useInitialFetchPolicyIfNecessary<TData, TVariables>(
    watchQueryOptions,
    observable
  );

  useResubscribeIfNecessary<TData, TVariables>(
    resultData, // might get mutated during render
    observable, // might get mutated during render
    watchQueryOptions
  );

  const result = useResult<TData, TVariables>(observable, resultData, ssr);

  const obsQueryFields = React.useMemo(
    () => ({
      refetch: observable.refetch.bind(observable),
      fetchMore: observable.fetchMore.bind(observable),
      updateQuery: observable.updateQuery.bind(observable),
      startPolling: observable.startPolling.bind(observable),
      stopPolling: observable.stopPolling.bind(observable),
      subscribeToMore: observable.subscribeToMore.bind(observable),
    }),
    [observable]
  );

  const previousData = resultData.previousData;
  return React.useMemo(() => {
    const { partial, ...rest } = result;

    return {
      ...rest,
      client,
      observable,
      variables: observable.variables,
      previousData,
      ...obsQueryFields,
    };
  }, [result, client, observable, previousData, obsQueryFields]);
}

const fromSkipToken = Symbol();

function useOptions<TData, TVariables extends OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken | useQuery.Options<NoInfer<TData>, NoInfer<TVariables>>,
  defaultOptions: Partial<ApolloClient.WatchQueryOptions<any, any>> | undefined
): ApolloClient.WatchQueryOptions<TData, TVariables> {
  return useDeepMemo<ApolloClient.WatchQueryOptions<TData, TVariables>>(() => {
    if (options === skipToken) {
      const opts: ApolloClient.WatchQueryOptions<TData, TVariables> = {
        ...mergeOptions(defaultOptions as any, {
          query,
          fetchPolicy: "standby",
        }),
        [variablesUnknownSymbol]: true,
      };
      (opts as any)[fromSkipToken] = true;

      return opts;
    }

    const watchQueryOptions: ApolloClient.WatchQueryOptions<TData, TVariables> =
      mergeOptions(defaultOptions as any, { ...options, query });

    if (options.skip) {
      watchQueryOptions.initialFetchPolicy =
        options.initialFetchPolicy || options.fetchPolicy;
      watchQueryOptions.fetchPolicy = "standby";
    }

    return watchQueryOptions;
  }, [query, options, defaultOptions]);
}

function useInitialFetchPolicyIfNecessary<
  TData,
  TVariables extends OperationVariables,
>(
  watchQueryOptions: ApolloClient.WatchQueryOptions<TData, TVariables>,
  observable: ObsQueryWithMeta<TData, TVariables>
) {
  "use no memo";
  if (!watchQueryOptions.fetchPolicy) {
    watchQueryOptions.fetchPolicy = observable.options.initialFetchPolicy;
  }
}

function useResult<TData, TVariables extends OperationVariables>(
  observable: ObsQueryWithMeta<TData, TVariables>,
  resultData: InternalResult<TData>,
  ssr: boolean | undefined
) {
  "use no memo";
  return useSyncExternalStore(
    React.useCallback(
      (handleStoreChange) => {
        const subscription = observable
          // We use the asapScheduler here to prevent issues with trying to
          // update in the middle of a render. `reobserve` is kicked off in the
          // middle of a render and because RxJS emits values synchronously,
          // its possible for this `handleStoreChange` to be called in that same
          // render. This allows the render to complete before trying to emit a
          // new value.
          .pipe(observeOn(asapScheduler))
          .subscribe((result) => {
            const previous = resultData.current;

            if (
              // Avoid rerendering if the result is the same
              equal(previous, result) &&
              // Force rerender if the value was emitted because variables
              // changed, such as when calling `refetch(newVars)` which returns
              // the same data when `notifyOnNetworkStatusChange` is `false`.
              equal(resultData.variables, observable.variables)
            ) {
              return;
            }

            // eslint-disable-next-line react-compiler/react-compiler
            resultData.variables = observable.variables;

            if (previous.data && !equal(previous.data, result.data)) {
              resultData.previousData = previous.data as TData;
            }

            resultData.current = result;
            handleStoreChange();
          });

        // Do the "unsubscribe" with a short delay.
        // This way, an existing subscription can be reused without an additional
        // request if "unsubscribe"  and "resubscribe" to the same ObservableQuery
        // happen in very fast succession.
        return () => {
          setTimeout(() => subscription.unsubscribe());
        };
      },

      [observable, resultData]
    ),
    () => resultData.current,
    () => (ssr === false ? useQuery.ssrDisabledResult : resultData.current)
  );
}

// this hook is not compatible with any rules of React, and there's no good way to rewrite it.
// it should stay a separate hook that will not be optimized by the compiler
function useResubscribeIfNecessary<
  TData,
  TVariables extends OperationVariables,
>(
  /** this hook will mutate properties on `resultData` */
  resultData: InternalResult<TData>,
  /** this hook will mutate properties on `observable` */
  observable: ObsQueryWithMeta<TData, TVariables>,
  watchQueryOptions: Readonly<ApolloClient.WatchQueryOptions<TData, TVariables>>
) {
  "use no memo";
  if (
    observable[lastWatchOptions] &&
    !equal(observable[lastWatchOptions], watchQueryOptions)
  ) {
    // If skipToken was used to generate options, we won't know the correct
    // initialFetchPolicy until the hook is rerendered with real options, so we
    // set it the next time we get real options
    if (
      (observable[lastWatchOptions] as any)[fromSkipToken] &&
      !watchQueryOptions.initialFetchPolicy
    ) {
      (watchQueryOptions.initialFetchPolicy as any) =
        watchQueryOptions.fetchPolicy;
    }
    // Though it might be tempting to postpone this reobserve call to the
    // useEffect block, we need getCurrentResult to return an appropriate
    // loading:true result synchronously (later within the same call to
    // useQuery). Since we already have this.observable here (not true for
    // the very first call to useQuery), we are not initiating any new
    // subscriptions, though it does feel less than ideal that reobserve
    // (potentially) kicks off a network request (for example, when the
    // variables have changed), which is technically a side-effect.
    if (shouldReobserve(observable[lastWatchOptions], watchQueryOptions)) {
      observable.reobserve(watchQueryOptions);
    } else {
      observable.applyOptions(watchQueryOptions);
    }

    // Make sure getCurrentResult returns a fresh ApolloQueryResult<TData>,
    // but save the current data as this.previousData, just like setResult
    // usually does.
    const result = observable.getCurrentResult();

    if (!equal(result.data, resultData.current.data)) {
      resultData.previousData = (resultData.current.data ||
        (resultData.previousData as TData)) as TData;
    }
    resultData.current = result;
    resultData.variables = observable.variables;
  }
  observable[lastWatchOptions] = watchQueryOptions;
}

function shouldReobserve<TData, TVariables extends OperationVariables>(
  previousOptions: Readonly<ApolloClient.WatchQueryOptions<TData, TVariables>>,
  options: Readonly<ApolloClient.WatchQueryOptions<TData, TVariables>>
) {
  return (
    previousOptions.query !== options.query ||
    !equal(previousOptions.variables, options.variables) ||
    (previousOptions.fetchPolicy !== options.fetchPolicy &&
      (options.fetchPolicy === "standby" ||
        previousOptions.fetchPolicy === "standby"))
  );
}

useQuery.ssrDisabledResult = maybeDeepFreeze({
  loading: true,
  data: void 0 as any,
  dataState: "empty",
  error: void 0,
  networkStatus: NetworkStatus.loading,
  partial: true,
}) satisfies ObservableQuery.Result<any> as ObservableQuery.Result<any>;
