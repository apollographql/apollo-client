import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import * as React from "rehackt";

import type {
  ApolloClient,
  ApolloQueryResult,
  DefaultContext,
  MaybeMasked,
  ObservableQuery,
  OperationVariables,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "../../core/index.js";
import { ApolloError, NetworkStatus } from "../../core/index.js";
import {
  compact,
  isNonEmptyArray,
  maybeDeepFreeze,
  mergeOptions,
} from "../../utilities/index.js";
import type {
  NoInfer,
  ObservableQueryFields,
  QueryHookOptions,
  QueryResult,
} from "../types/types.js";
import type { InternalResult, ObsQueryWithMeta } from "./useQuery.js";
import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import type {
  ErrorPolicy,
  NextFetchPolicyContext,
  RefetchWritePolicy,
} from "../../core/watchQueryOptions.js";
import { useApolloClient } from "./useApolloClient.js";
import { getApolloContext } from "../context/index.js";
import { DocumentType, verifyDocumentType } from "../parser/index.js";
import type { RenderPromises } from "../ssr/index.js";
import { invariant } from "../../utilities/globals/index.js";
import equal from "@wry/equality";
import { useDeepMemo } from "./internal/useDeepMemo.js";
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

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#ssr:member} */
  ssr?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
  client?: ApolloClient<any>;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#onCompleted:member} */
  onCompleted?: (data: MaybeMasked<TData>) => void;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#onError:member} */
  onError?: (error: ApolloError) => void;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: TVariables;
}

export interface LazyQueryHookExecOptions<
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: TVariables;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
}

export type LazyQueryExecFunction<
  TData,
  TVariables extends OperationVariables,
> = (
  options?: LazyQueryHookExecOptions<TVariables>
) => Promise<ApolloQueryResult<TData>>;

export type LazyQueryResultTuple<
  TData,
  TVariables extends OperationVariables,
> = [
  execute: LazyQueryExecFunction<TData, TVariables>,
  result: QueryResult<TData, TVariables>,
];

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

const INITIAL_RESULT: ApolloQueryResult<any> = Object.freeze({
  data: undefined,
  loading: false,
  networkStatus: NetworkStatus.ready,
});

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
  const calledRef = React.useRef(false);
  const previousDataRef = React.useRef<TData>(undefined);
  const stableOptions = useDeepMemo(() => options, [options]);

  const [observable] = React.useState(() => {
    const observable = client.watchQuery({
      ...stableOptions,
      query,
      initialFetchPolicy: options?.fetchPolicy,
      fetchPolicy: "standby",
    });

    observable["queryInfo"].networkStatus = NetworkStatus.ready;

    return observable;
  });

  const [observableResult, setObservableResult] =
    React.useState<ApolloQueryResult<TData>>(INITIAL_RESULT);

  const obsQueryFields = React.useMemo<
    Omit<ObservableQueryFields<TData, TVariables>, "variables">
  >(() => bindObservableMethods(observable), [observable]);

  React.useEffect(() => {
    const subscription = observable.subscribe({
      next: (value) => {
        setObservableResult((previous) => {
          const current = observable.getCurrentResult();

          return equal(previous, current) ? previous : current;
        });
      },
    });

    return () => subscription.unsubscribe();
  }, [observable]);

  // We use useMemo here to make sure the eager methods have a stable identity.
  const eagerMethods = React.useMemo(() => {
    const eagerMethods: Record<string, any> = {};
    for (const key of EAGER_METHODS) {
      const method = obsQueryFields[key];
      eagerMethods[key] = function () {
        calledRef.current = true;
        previousDataRef.current = observableResult.data;
        // @ts-expect-error this is just too generic to type
        return method.apply(this, arguments);
      };
    }

    return eagerMethods as typeof obsQueryFields;
  }, [obsQueryFields, observableResult.data]);

  const execute: LazyQueryExecFunction<TData, TVariables> = (
    executeOptions
  ) => {
    calledRef.current = true;
    previousDataRef.current = observableResult.data;

    const options: Partial<WatchQueryOptions<TVariables, TData>> = {
      fetchPolicy:
        stableOptions?.fetchPolicy ||
        client.defaultOptions.watchQuery?.fetchPolicy ||
        "cache-first",
    };

    if (executeOptions?.variables) {
      options.variables = executeOptions.variables;
    }

    const promise = observable.reobserve(options);

    // Call setObservableResult after calling reobserve due to the timing of
    // rerendering in React 17. Without this, the `variables` value is returned
    // with the previous set of variables.
    if (observableResult === INITIAL_RESULT) {
      setObservableResult(observable.getCurrentResult());
    }

    return promise;
    // execOptionsRef.current =
    //   executeOptions ?
    //     {
    //       ...executeOptions,
    //       fetchPolicy: executeOptions.fetchPolicy || initialFetchPolicy,
    //     }
    //   : {
    //       fetchPolicy: initialFetchPolicy,
    //     };
    //
    // const options = mergeOptions(optionsRef.current, {
    //   query: queryRef.current,
    //   ...execOptionsRef.current,
    // });
    //
    // const promise = executeQuery(
    //   resultData,
    //   observable,
    //   client,
    //   document,
    //   { ...options, skip: false },
    //   onQueryExecuted
    // ).then((queryResult) => Object.assign(queryResult, eagerMethods));
    //
    // // Because the return value of `useLazyQuery` is usually floated, we need
    // // to catch the promise to prevent unhandled rejections.
    // promise.catch(() => {});
    //
    // return promise;
  };

  const executeRef = React.useRef(execute);
  useIsomorphicLayoutEffect(() => {
    executeRef.current = execute;
  });

  const stableExecute = React.useCallback<typeof execute>(
    (...args) => executeRef.current(...args),
    []
  );

  const result = React.useMemo(() => {
    return {
      ...observableResult,
      ...eagerMethods,
      // TODO: Ensure the `data` key is set from the core API regardless of
      // whether the value is undefined.
      data: observableResult.data,
      // loading: called ? observableResult.loading : false,
      // networkStatus:
      //   called ? observableResult.networkStatus : NetworkStatus.ready,
      client,
      observable,
      called: calledRef.current,
      previousData: previousDataRef.current,
      variables:
        equal(observable.variables, {}) ? undefined : observable.variables,
    };
  }, [observableResult, eagerMethods, client, observable]);

  return [stableExecute, result];
}

function createMakeWatchQueryOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  client: ApolloClient<object>,
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  {
    skip,
    ssr,
    onCompleted,
    onError,
    defaultOptions,
    // The above options are useQuery-specific, so this ...otherOptions spread
    // makes otherOptions almost a WatchQueryOptions object, except for the
    // query property that we add below.
    ...otherOptions
  }: QueryHookOptions<TData, TVariables> = {},
  isSyncSSR: boolean
) {
  return (
    observable?: ObservableQuery<TData, TVariables>
  ): WatchQueryOptions<TVariables, TData> => {
    // This Object.assign is safe because otherOptions is a fresh ...rest object
    // that did not exist until just now, so modifications are still allowed.
    const watchQueryOptions: WatchQueryOptions<TVariables, TData> =
      Object.assign(otherOptions, { query });

    if (
      isSyncSSR &&
      (watchQueryOptions.fetchPolicy === "network-only" ||
        watchQueryOptions.fetchPolicy === "cache-and-network")
    ) {
      // this behavior was added to react-apollo without explanation in this PR
      // https://github.com/apollographql/react-apollo/pull/1579
      watchQueryOptions.fetchPolicy = "cache-first";
    }

    if (!watchQueryOptions.variables) {
      watchQueryOptions.variables = {} as TVariables;
    }

    if (skip) {
      // When skipping, we set watchQueryOptions.fetchPolicy initially to
      // "standby", but we also need/want to preserve the initial non-standby
      // fetchPolicy that would have been used if not skipping.
      watchQueryOptions.initialFetchPolicy =
        watchQueryOptions.initialFetchPolicy ||
        watchQueryOptions.fetchPolicy ||
        getDefaultFetchPolicy(defaultOptions, client.defaultOptions);
      watchQueryOptions.fetchPolicy = "standby";
    } else if (!watchQueryOptions.fetchPolicy) {
      watchQueryOptions.fetchPolicy =
        observable?.options.initialFetchPolicy ||
        getDefaultFetchPolicy(defaultOptions, client.defaultOptions);
    }

    return watchQueryOptions;
  };
}

function useQueryInternals<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: QueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
) {
  const client = useApolloClient(options.client);

  const renderPromises = React.useContext(getApolloContext()).renderPromises;
  const isSyncSSR = !!renderPromises;
  const disableNetworkFetches = client.disableNetworkFetches;
  const ssrAllowed = options.ssr !== false && !options.skip;

  const makeWatchQueryOptions = createMakeWatchQueryOptions(
    client,
    query,
    options,
    isSyncSSR
  );

  const [{ observable, resultData }, onQueryExecuted] = useInternalState(
    client,
    query,
    options,
    renderPromises,
    makeWatchQueryOptions
  );

  const watchQueryOptions: Readonly<WatchQueryOptions<TVariables, TData>> =
    makeWatchQueryOptions(observable);

  useResubscribeIfNecessary<TData, TVariables>(
    resultData, // might get mutated during render
    observable, // might get mutated during render
    client,
    options,
    watchQueryOptions
  );

  const obsQueryFields = React.useMemo<
    Omit<ObservableQueryFields<TData, TVariables>, "variables">
  >(() => bindObservableMethods(observable), [observable]);

  useRegisterSSRObservable(observable, renderPromises, ssrAllowed);

  const result = useObservableSubscriptionResult<TData, TVariables>(
    resultData,
    observable,
    client,
    options,
    watchQueryOptions,
    disableNetworkFetches,
    isSyncSSR,
    {
      onCompleted: options.onCompleted || noop,
      onError: options.onError || noop,
    }
  );

  return {
    result,
    obsQueryFields,
    observable,
    resultData,
    client,
    onQueryExecuted,
  };
}

function useResubscribeIfNecessary<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  /** this hook will mutate properties on `resultData` */
  resultData: InternalResult<TData, TVariables>,
  /** this hook will mutate properties on `observable` */
  observable: ObsQueryWithMeta<TData, TVariables>,
  client: ApolloClient<object>,
  options: QueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
  watchQueryOptions: Readonly<WatchQueryOptions<TVariables, TData>>
) {
  if (
    observable[lastWatchOptions] &&
    !equal(observable[lastWatchOptions], watchQueryOptions)
  ) {
    // Though it might be tempting to postpone this reobserve call to the
    // useEffect block, we need getCurrentResult to return an appropriate
    // loading:true result synchronously (later within the same call to
    // useQuery). Since we already have this.observable here (not true for
    // the very first call to useQuery), we are not initiating any new
    // subscriptions, though it does feel less than ideal that reobserve
    // (potentially) kicks off a network request (for example, when the
    // variables have changed), which is technically a side-effect.
    observable.reobserve(
      getObsQueryOptions(observable, client, options, watchQueryOptions)
    );

    // Make sure getCurrentResult returns a fresh ApolloQueryResult<TData>,
    // but save the current data as this.previousData, just like setResult
    // usually does.
    resultData.previousData =
      resultData.current?.data || resultData.previousData;
    resultData.current = void 0;
  }
  observable[lastWatchOptions] = watchQueryOptions;
}

interface InternalState<TData, TVariables extends OperationVariables> {
  client: ReturnType<typeof useApolloClient>;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  observable: ObsQueryWithMeta<TData, TVariables>;
  resultData: InternalResult<TData, TVariables>;
}

const lastWatchOptions = Symbol();

function useInternalState<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  client: ApolloClient<object>,
  query: DocumentNode | TypedDocumentNode<any, any>,
  options: QueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
  renderPromises: RenderPromises | undefined,
  makeWatchQueryOptions: () => WatchQueryOptions<TVariables, TData>
) {
  function createInternalState(previous?: InternalState<TData, TVariables>) {
    verifyDocumentType(query, DocumentType.Query);

    const internalState: InternalState<TData, TVariables> = {
      client,
      query,
      observable:
        // See if there is an existing observable that was used to fetch the same
        // data and if so, use it instead since it will contain the proper queryId
        // to fetch the result set. This is used during SSR.
        (renderPromises &&
          renderPromises.getSSRObservable(makeWatchQueryOptions())) ||
        client.watchQuery(
          getObsQueryOptions(void 0, client, options, makeWatchQueryOptions())
        ),
      resultData: {
        // Reuse previousData from previous InternalState (if any) to provide
        // continuity of previousData even if/when the query or client changes.
        previousData: previous?.resultData.current?.data,
      },
    };

    return internalState as InternalState<TData, TVariables>;
  }

  let [internalState, updateInternalState] =
    React.useState(createInternalState);

  /**
   * Used by `useLazyQuery` when a new query is executed.
   * We keep this logic here since it needs to update things in unsafe
   * ways and here we at least can keep track of that in a single place.
   */
  function onQueryExecuted(
    watchQueryOptions: WatchQueryOptions<TVariables, TData>
  ) {
    // this needs to be set to prevent an immediate `resubscribe` in the
    // next rerender of the `useQuery` internals
    Object.assign(internalState.observable, {
      [lastWatchOptions]: watchQueryOptions,
    });
    const resultData = internalState.resultData;
    updateInternalState({
      ...internalState,
      // might be a different query
      query: watchQueryOptions.query,
      resultData: Object.assign(resultData, {
        // We need to modify the previous `resultData` object as we rely on the
        // object reference in other places
        previousData: resultData.current?.data || resultData.previousData,
        current: undefined,
      }),
    });
  }

  if (client !== internalState.client || query !== internalState.query) {
    // If the client or query have changed, we need to create a new InternalState.
    // This will trigger a re-render with the new state, but it will also continue
    // to run the current render function to completion.
    // Since we sometimes trigger some side-effects in the render function, we
    // re-assign `state` to the new state to ensure that those side-effects are
    // triggered with the new state.
    const newInternalState = createInternalState(internalState);
    updateInternalState(newInternalState);
    return [newInternalState, onQueryExecuted] as const;
  }

  return [internalState, onQueryExecuted] as const;
}

function executeQuery<TData, TVariables extends OperationVariables>(
  resultData: InternalResult<TData, TVariables>,
  observable: ObsQueryWithMeta<TData, TVariables>,
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

function useRegisterSSRObservable(
  observable: ObsQueryWithMeta<any, any>,
  renderPromises: RenderPromises | undefined,
  ssrAllowed: boolean
) {
  if (renderPromises && ssrAllowed) {
    renderPromises.registerSSRObservable(observable);

    if (observable.getCurrentResult().loading) {
      // TODO: This is a legacy API which could probably be cleaned up
      renderPromises.addObservableQueryPromise(observable);
    }
  }
}

function useObservableSubscriptionResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  resultData: InternalResult<TData, TVariables>,
  observable: ObservableQuery<TData, TVariables>,
  client: ApolloClient<object>,
  options: QueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
  watchQueryOptions: Readonly<WatchQueryOptions<TVariables, TData>>,
  disableNetworkFetches: boolean,
  isSyncSSR: boolean,
  callbacks: {
    onCompleted: (data: MaybeMasked<TData>) => void;
    onError: (error: ApolloError) => void;
  }
) {
  const callbackRef = React.useRef<Callbacks<TData>>(callbacks);
  React.useEffect(() => {
    // Make sure state.onCompleted and state.onError always reflect the latest
    // options.onCompleted and options.onError callbacks provided to useQuery,
    // since those functions are often recreated every time useQuery is called.
    // Like the forceUpdate method, the versions of these methods inherited from
    // InternalState.prototype are empty no-ops, but we can override them on the
    // base state object (without modifying the prototype).

    callbackRef.current = callbacks;
  });

  const resultOverride =
    (
      (isSyncSSR || disableNetworkFetches) &&
      options.ssr === false &&
      !options.skip
    ) ?
      // If SSR has been explicitly disabled, and this function has been called
      // on the server side, return the default loading state.
      ssrDisabledResult
    : options.skip || watchQueryOptions.fetchPolicy === "standby" ?
      // When skipping a query (ie. we're not querying for data but still want to
      // render children), make sure the `data` is cleared out and `loading` is
      // set to `false` (since we aren't loading anything).
      //
      // NOTE: We no longer think this is the correct behavior. Skipping should
      // not automatically set `data` to `undefined`, but instead leave the
      // previous data in place. In other words, skipping should not mandate that
      // previously received data is all of a sudden removed. Unfortunately,
      // changing this is breaking, so we'll have to wait until Apollo Client 4.0
      // to address this.
      skipStandbyResult
    : void 0;

  const previousData = resultData.previousData;
  const currentResultOverride = React.useMemo(
    () =>
      resultOverride &&
      toQueryResult(resultOverride, previousData, observable, client),
    [client, observable, resultOverride, previousData]
  );

  return useSyncExternalStore(
    React.useCallback(
      (handleStoreChange) => {
        // reference `disableNetworkFetches` here to ensure that the rules of hooks
        // keep it as a dependency of this effect, even though it's not used
        disableNetworkFetches;

        if (isSyncSSR) {
          return () => {};
        }

        const onNext = () => {
          const previousResult = resultData.current;
          // We use `getCurrentResult()` instead of the onNext argument because
          // the values differ slightly. Specifically, loading results will have
          // an empty object for data instead of `undefined` for some reason.
          const result = observable.getCurrentResult();
          // Make sure we're not attempting to re-render similar results
          if (
            previousResult &&
            previousResult.loading === result.loading &&
            previousResult.networkStatus === result.networkStatus &&
            equal(previousResult.data, result.data)
          ) {
            return;
          }

          setResult(
            result,
            resultData,
            observable,
            client,
            handleStoreChange,
            callbackRef.current
          );
        };

        const onError = (error: Error) => {
          subscription.current.unsubscribe();
          subscription.current = observable.resubscribeAfterError(
            onNext,
            onError
          );

          if (!hasOwnProperty.call(error, "graphQLErrors")) {
            // The error is not a GraphQL error
            throw error;
          }

          const previousResult = resultData.current;
          if (
            !previousResult ||
            (previousResult && previousResult.loading) ||
            !equal(error, previousResult.error)
          ) {
            setResult(
              {
                data: (previousResult &&
                  previousResult.data) as MaybeMasked<TData>,
                error: error as ApolloError,
                loading: false,
                networkStatus: NetworkStatus.error,
              },
              resultData,
              observable,
              client,
              handleStoreChange,
              callbackRef.current
            );
          }
        };

        // TODO evaluate if we keep this in
        // React Compiler cannot handle scoped `let` access, but a mutable object
        // like this is fine.
        // was:
        // let subscription = observable.subscribe(onNext, onError);
        const subscription = { current: observable.subscribe(onNext, onError) };

        // Do the "unsubscribe" with a short delay.
        // This way, an existing subscription can be reused without an additional
        // request if "unsubscribe"  and "resubscribe" to the same ObservableQuery
        // happen in very fast succession.
        return () => {
          setTimeout(() => subscription.current.unsubscribe());
        };
      },

      [disableNetworkFetches, isSyncSSR, observable, resultData, client]
    ),
    () =>
      currentResultOverride ||
      getCurrentResult(resultData, observable, callbackRef.current, client),
    () =>
      currentResultOverride ||
      getCurrentResult(resultData, observable, callbackRef.current, client)
  );
}
function noop() {}
function getCurrentResult<TData, TVariables extends OperationVariables>(
  resultData: InternalResult<TData, TVariables>,
  observable: ObservableQuery<TData, TVariables>,
  callbacks: Callbacks<TData>,
  client: ApolloClient<object>
): InternalQueryResult<TData, TVariables> {
  // Using this.result as a cache ensures getCurrentResult continues returning
  // the same (===) result object, unless state.setResult has been called, or
  // we're doing server rendering and therefore override the result below.
  if (!resultData.current) {
    setResult(
      observable.getCurrentResult(),
      resultData,
      observable,
      client,
      () => {},
      callbacks
    );
  }
  return resultData.current!;
}
interface Callbacks<TData> {
  // Defining these methods as no-ops on the prototype allows us to call
  // state.onCompleted and/or state.onError without worrying about whether a
  // callback was provided.
  onCompleted(data: MaybeMasked<TData>): void;
  onError(error: ApolloError): void;
}
function setResult<TData, TVariables extends OperationVariables>(
  nextResult: ApolloQueryResult<MaybeMasked<TData>>,
  resultData: InternalResult<TData, TVariables>,
  observable: ObservableQuery<TData, TVariables>,
  client: ApolloClient<object>,
  forceUpdate: () => void,
  callbacks: Callbacks<TData>
) {
  const previousResult = resultData.current;
  if (previousResult && previousResult.data) {
    resultData.previousData = previousResult.data;
  }

  if (!nextResult.error && isNonEmptyArray(nextResult.errors)) {
    // Until a set naming convention for networkError and graphQLErrors is
    // decided upon, we map errors (graphQLErrors) to the error options.
    // TODO: Is it possible for both result.error and result.errors to be
    // defined here?
    nextResult.error = new ApolloError({ graphQLErrors: nextResult.errors });
  }

  resultData.current = toQueryResult(
    nextResult,
    resultData.previousData,
    observable,
    client
  );
  // Calling state.setResult always triggers an update, though some call sites
  // perform additional equality checks before committing to an update.
  forceUpdate();
  handleErrorOrCompleted(nextResult, previousResult?.networkStatus, callbacks);
}
type InternalQueryResult<TData, TVariables extends OperationVariables> = Omit<
  QueryResult<TData, TVariables>,
  Exclude<keyof ObservableQueryFields<TData, TVariables>, "variables">
>;
function handleErrorOrCompleted<TData>(
  result: ApolloQueryResult<MaybeMasked<TData>>,
  previousNetworkStatus: NetworkStatus | undefined,
  callbacks: Callbacks<TData>
) {
  if (!result.loading) {
    const error = toApolloError(result);

    // wait a tick in case we are in the middle of rendering a component
    Promise.resolve()
      .then(() => {
        if (error) {
          callbacks.onError(error);
        } else if (
          result.data &&
          previousNetworkStatus !== result.networkStatus &&
          result.networkStatus === NetworkStatus.ready
        ) {
          callbacks.onCompleted(result.data);
        }
      })
      .catch((error) => {
        invariant.warn(error);
      });
  }
}
export function toApolloError<TData>(
  result: Pick<ApolloQueryResult<TData>, "errors" | "error">
): ApolloError | undefined {
  return isNonEmptyArray(result.errors) ?
      new ApolloError({ graphQLErrors: result.errors })
    : result.error;
}
const {
  prototype: { hasOwnProperty },
} = Object;
const ssrDisabledResult = maybeDeepFreeze({
  loading: true,
  data: void 0 as any,
  error: void 0,
  networkStatus: NetworkStatus.loading,
});

const skipStandbyResult = maybeDeepFreeze({
  loading: false,
  data: void 0 as any,
  error: void 0,
  networkStatus: NetworkStatus.ready,
});

function getObsQueryOptions<TData, TVariables extends OperationVariables>(
  observable: ObservableQuery<TData, TVariables> | undefined,
  client: ApolloClient<object>,
  queryHookOptions: QueryHookOptions<TData, TVariables>,
  watchQueryOptions: Partial<WatchQueryOptions<TVariables, TData>>
): WatchQueryOptions<TVariables, TData> {
  const toMerge: Array<Partial<WatchQueryOptions<TVariables, TData>>> = [];

  const globalDefaults = client.defaultOptions.watchQuery;
  if (globalDefaults) toMerge.push(globalDefaults);

  if (queryHookOptions.defaultOptions) {
    toMerge.push(queryHookOptions.defaultOptions);
  }

  // We use compact rather than mergeOptions for this part of the merge,
  // because we want watchQueryOptions.variables (if defined) to replace
  // this.observable.options.variables whole. This replacement allows
  // removing variables by removing them from the variables input to
  // useQuery. If the variables were always merged together (rather than
  // replaced), there would be no way to remove existing variables.
  // However, the variables from options.defaultOptions and globalDefaults
  // (if provided) should be merged, to ensure individual defaulted
  // variables always have values, if not otherwise defined in
  // observable.options or watchQueryOptions.
  toMerge.push(compact(observable && observable.options, watchQueryOptions));

  return toMerge.reduce(mergeOptions) as WatchQueryOptions<TVariables, TData>;
}

function toQueryResult<TData, TVariables extends OperationVariables>(
  result: ApolloQueryResult<MaybeMasked<TData>>,
  previousData: MaybeMasked<TData> | undefined,
  observable: ObservableQuery<TData, TVariables>,
  client: ApolloClient<object>
): InternalQueryResult<TData, TVariables> {
  const { data, partial, ...resultWithoutPartial } = result;
  const queryResult: InternalQueryResult<TData, TVariables> = {
    data, // Ensure always defined, even if result.data is missing.
    ...resultWithoutPartial,
    client: client,
    observable: observable,
    variables: observable.variables,
    called: result !== ssrDisabledResult && result !== skipStandbyResult,
    previousData,
  };
  return queryResult;
}
