import { invariant } from "../../utilities/globals/index.js";

import * as React from "rehackt";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
import { equal } from "@wry/equality";

import type {
  DefaultOptions,
  OperationVariables,
  WatchQueryFetchPolicy,
} from "../../core/index.js";
import { mergeOptions } from "../../utilities/index.js";
import { getApolloContext } from "../context/index.js";
import { ApolloError } from "../../errors/index.js";
import type {
  ApolloClient,
  ApolloQueryResult,
  ObservableQuery,
  DocumentNode,
  TypedDocumentNode,
  WatchQueryOptions,
} from "../../core/index.js";
import { NetworkStatus } from "../../core/index.js";
import type {
  QueryHookOptions,
  QueryResult,
  ObservableQueryFields,
  NoInfer,
} from "../types/types.js";

import { DocumentType, verifyDocumentType } from "../parser/index.js";
import { useApolloClient } from "./useApolloClient.js";
import {
  compact,
  isNonEmptyArray,
  maybeDeepFreeze,
} from "../../utilities/index.js";
import { wrapHook } from "./internal/index.js";

const {
  prototype: { hasOwnProperty },
} = Object;

const originalResult = Symbol();
interface InternalQueryResult<TData, TVariables extends OperationVariables>
  extends QueryResult<TData, TVariables> {
  [originalResult]: ApolloQueryResult<TData>;
}

const noop = () => {};

export interface InternalState<TData, TVariables extends OperationVariables> {
  readonly client: ReturnType<typeof useApolloClient>;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;

  queryHookOptions: QueryHookOptions<TData, TVariables>;
  watchQueryOptions: WatchQueryOptions<TVariables, TData>;

  observable: ObservableQuery<TData, TVariables>;
  obsQueryFields: Omit<ObservableQueryFields<TData, TVariables>, "variables">;
  // These members are populated by getCurrentResult and setResult, and it's
  // okay/normal for them to be initially undefined.
  result: undefined | InternalQueryResult<TData, TVariables>;
  previousData: undefined | TData;
}

interface Callbacks<TData> {
  // Defining these methods as no-ops on the prototype allows us to call
  // state.onCompleted and/or state.onError without worrying about whether a
  // callback was provided.
  onCompleted(data: TData): void;
  onError(error: ApolloError): void;
}

/**
 * A hook for executing queries in an Apollo application.
 *
 * To run a query within a React component, call `useQuery` and pass it a GraphQL query document.
 *
 * When your component renders, `useQuery` returns an object from Apollo Client that contains `loading`, `error`, and `data` properties you can use to render your UI.
 *
 * > Refer to the [Queries](https://www.apollographql.com/docs/react/data/queries) section for a more in-depth overview of `useQuery`.
 *
 * @example
 * ```jsx
 * import { gql, useQuery } from '@apollo/client';
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
 *     variables: { language: 'english' },
 *   });
 *   if (loading) return <p>Loading ...</p>;
 *   return <h1>Hello {data.greeting.message}!</h1>;
 * }
 * ```
 * @since 3.0.0
 * @param query - A GraphQL query document parsed into an AST by `gql`.
 * @param options - Options to control how the query is executed.
 * @returns Query result object
 */
export function useQuery<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: QueryHookOptions<
    NoInfer<TData>,
    NoInfer<TVariables>
  > = Object.create(null)
): QueryResult<TData, TVariables> {
  return wrapHook(
    "useQuery",
    _useQuery,
    useApolloClient(options && options.client)
  )(query, options);
}

function _useQuery<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: QueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
) {
  return useQueryWithInternalState(
    useInternalState(useApolloClient(options.client), query),
    options
  );
}

export function useQueryWithInternalState<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  internalState: InternalState<TData, TVariables>,
  options: QueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
) {
  // The renderPromises field gets initialized here in the useQuery method, at
  // the beginning of everything (for a given component rendering, at least),
  // so we can safely use this.renderPromises in other/later InternalState
  // methods without worrying it might be uninitialized. Even after
  // initialization, this.renderPromises is usually undefined (unless SSR is
  // happening), but that's fine as long as it has been initialized that way,
  // rather than left uninitialized.
  const renderPromises = React.useContext(getApolloContext()).renderPromises;

  const watchQueryOptions = createWatchQueryOptions(
    (internalState.queryHookOptions = options),
    internalState,
    !!renderPromises
  );

  // Update this.watchQueryOptions, but only when they have changed, which
  // allows us to depend on the referential stability of
  // this.watchQueryOptions elsewhere.
  const currentWatchQueryOptions = internalState.watchQueryOptions;

  if (!equal(watchQueryOptions, currentWatchQueryOptions)) {
    internalState.watchQueryOptions = watchQueryOptions;

    if (currentWatchQueryOptions && internalState.observable) {
      // Though it might be tempting to postpone this reobserve call to the
      // useEffect block, we need getCurrentResult to return an appropriate
      // loading:true result synchronously (later within the same call to
      // useQuery). Since we already have this.observable here (not true for
      // the very first call to useQuery), we are not initiating any new
      // subscriptions, though it does feel less than ideal that reobserve
      // (potentially) kicks off a network request (for example, when the
      // variables have changed), which is technically a side-effect.
      internalState.observable.reobserve(getObsQueryOptions(internalState));

      // Make sure getCurrentResult returns a fresh ApolloQueryResult<TData>,
      // but save the current data as this.previousData, just like setResult
      // usually does.
      internalState.previousData =
        internalState.result?.data || internalState.previousData;
      internalState.result = void 0;
    }
  }

  const _callbacks = {
    onCompleted: options.onCompleted || noop,
    onError: options.onError || noop,
  };
  const callbackRef = React.useRef<Callbacks<TData>>(_callbacks);
  React.useEffect(() => {
    // Make sure state.onCompleted and state.onError always reflect the latest
    // options.onCompleted and options.onError callbacks provided to useQuery,
    // since those functions are often recreated every time useQuery is called.
    // Like the forceUpdate method, the versions of these methods inherited from
    // InternalState.prototype are empty no-ops, but we can override them on the
    // base state object (without modifying the prototype).
    callbackRef.current = _callbacks;
  });

  // See if there is an existing observable that was used to fetch the same
  // data and if so, use it instead since it will contain the proper queryId
  // to fetch the result set. This is used during SSR.
  const obsQuery = (internalState.observable =
    (renderPromises &&
      renderPromises.getSSRObservable(internalState.watchQueryOptions)) ||
    internalState.observable || // Reuse this.observable if possible (and not SSR)
    internalState.client.watchQuery(getObsQueryOptions(internalState)));

  internalState.obsQueryFields = React.useMemo(
    () => ({
      refetch: obsQuery.refetch.bind(obsQuery),
      reobserve: obsQuery.reobserve.bind(obsQuery),
      fetchMore: obsQuery.fetchMore.bind(obsQuery),
      updateQuery: obsQuery.updateQuery.bind(obsQuery),
      startPolling: obsQuery.startPolling.bind(obsQuery),
      stopPolling: obsQuery.stopPolling.bind(obsQuery),
      subscribeToMore: obsQuery.subscribeToMore.bind(obsQuery),
    }),
    [obsQuery]
  );

  if (
    (renderPromises || internalState.client.disableNetworkFetches) &&
    internalState.queryHookOptions.ssr === false &&
    !internalState.queryHookOptions.skip
  ) {
    // If SSR has been explicitly disabled, and this function has been called
    // on the server side, return the default loading state.
    internalState.result = toQueryResult(ssrDisabledResult, internalState);
  } else if (
    internalState.queryHookOptions.skip ||
    internalState.watchQueryOptions.fetchPolicy === "standby"
  ) {
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
    internalState.result = toQueryResult(skipStandbyResult, internalState);
  } else if (
    internalState.result?.[originalResult] === ssrDisabledResult ||
    internalState.result?.[originalResult] === skipStandbyResult
  ) {
    internalState.result = void 0;
  }

  const ssrAllowed = !(
    internalState.queryHookOptions.ssr === false ||
    internalState.queryHookOptions.skip
  );

  if (renderPromises && ssrAllowed) {
    renderPromises.registerSSRObservable(obsQuery);

    if (obsQuery.getCurrentResult().loading) {
      // TODO: This is a legacy API which could probably be cleaned up
      renderPromises.addObservableQueryPromise(obsQuery);
    }
  }

  const result = useSyncExternalStore(
    React.useCallback(
      (handleStoreChange) => {
        if (renderPromises) {
          return () => {};
        }

        const onNext = () => {
          const previousResult = internalState.result;
          // We use `getCurrentResult()` instead of the onNext argument because
          // the values differ slightly. Specifically, loading results will have
          // an empty object for data instead of `undefined` for some reason.
          const result = obsQuery.getCurrentResult();
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
            handleStoreChange,
            internalState,
            callbackRef.current
          );
        };

        const onError = (error: Error) => {
          subscription.unsubscribe();
          subscription = obsQuery.resubscribeAfterError(onNext, onError);

          if (!hasOwnProperty.call(error, "graphQLErrors")) {
            // The error is not a GraphQL error
            throw error;
          }

          const previousResult = internalState.result;
          if (
            !previousResult ||
            (previousResult && previousResult.loading) ||
            !equal(error, previousResult.error)
          ) {
            setResult(
              {
                data: (previousResult && previousResult.data) as TData,
                error: error as ApolloError,
                loading: false,
                networkStatus: NetworkStatus.error,
              },
              handleStoreChange,
              internalState,
              callbackRef.current
            );
          }
        };

        let subscription = obsQuery.subscribe(onNext, onError);

        // Do the "unsubscribe" with a short delay.
        // This way, an existing subscription can be reused without an additional
        // request if "unsubscribe"  and "resubscribe" to the same ObservableQuery
        // happen in very fast succession.
        return () => {
          setTimeout(() => subscription.unsubscribe());
        };
      },
      // eslint-disable-next-line react-compiler/react-compiler
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        // We memoize the subscribe function using useCallback and the following
        // dependency keys, because the subscribe function reference is all that
        // useSyncExternalStore uses internally as a dependency key for the
        // useEffect ultimately responsible for the subscription, so we are
        // effectively passing this dependency array to that useEffect buried
        // inside useSyncExternalStore, as desired.
        obsQuery,
        renderPromises,
        internalState.client.disableNetworkFetches,
      ]
    ),

    () => getCurrentResult(internalState, callbackRef.current),
    () => getCurrentResult(internalState, callbackRef.current)
  );

  return result;
}

export function useInternalState<TData, TVariables extends OperationVariables>(
  client: ApolloClient<any>,
  query: DocumentNode | TypedDocumentNode<TData, TVariables>
): InternalState<TData, TVariables> {
  function createInternalState(previous?: InternalState<TData, TVariables>) {
    verifyDocumentType(query, DocumentType.Query);

    // Reuse previousData from previous InternalState (if any) to provide
    // continuity of previousData even if/when the query or client changes.
    const previousResult = previous && previous.result;
    const previousData = previousResult && previousResult.data;
    const internalState: Partial<InternalState<TData, TVariables>> = {
      client,
      query,
    };
    if (previousData) {
      internalState.previousData = previousData;
    }

    return internalState as InternalState<TData, TVariables>;
  }

  let [state, updateState] = React.useState(createInternalState);

  if (client !== state.client || query !== state.query) {
    // If the client or query have changed, we need to create a new InternalState.
    // This will trigger a re-render with the new state, but it will also continue
    // to run the current render function to completion.
    // Since we sometimes trigger some side-effects in the render function, we
    // re-assign `state` to the new state to ensure that those side-effects are
    // triggered with the new state.
    updateState((state = createInternalState(state)));
  }

  return state;
}

// A function to massage options before passing them to ObservableQuery.
export function createWatchQueryOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
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
  internalState: InternalState<TData, TVariables>,
  hasRenderPromises: boolean
): WatchQueryOptions<TVariables, TData> {
  // This Object.assign is safe because otherOptions is a fresh ...rest object
  // that did not exist until just now, so modifications are still allowed.
  const watchQueryOptions: WatchQueryOptions<TVariables, TData> = Object.assign(
    otherOptions,
    { query: internalState.query }
  );

  if (
    hasRenderPromises &&
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
    const {
      fetchPolicy = getDefaultFetchPolicy(
        internalState.queryHookOptions.defaultOptions,
        internalState.client.defaultOptions
      ),
      initialFetchPolicy = fetchPolicy,
    } = watchQueryOptions;

    // When skipping, we set watchQueryOptions.fetchPolicy initially to
    // "standby", but we also need/want to preserve the initial non-standby
    // fetchPolicy that would have been used if not skipping.
    Object.assign(watchQueryOptions, {
      initialFetchPolicy,
      fetchPolicy: "standby",
    });
  } else if (!watchQueryOptions.fetchPolicy) {
    watchQueryOptions.fetchPolicy =
      internalState.observable?.options.initialFetchPolicy ||
      getDefaultFetchPolicy(
        internalState.queryHookOptions.defaultOptions,
        internalState.client.defaultOptions
      );
  }

  return watchQueryOptions;
}

export function getObsQueryOptions<
  TData,
  TVariables extends OperationVariables,
>(
  internalState: InternalState<TData, TVariables>
): WatchQueryOptions<TVariables, TData> {
  const toMerge: Array<Partial<WatchQueryOptions<TVariables, TData>>> = [];

  const globalDefaults = internalState.client.defaultOptions.watchQuery;
  if (globalDefaults) toMerge.push(globalDefaults);

  if (internalState.queryHookOptions.defaultOptions) {
    toMerge.push(internalState.queryHookOptions.defaultOptions);
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
  toMerge.push(
    compact(
      internalState.observable && internalState.observable.options,
      internalState.watchQueryOptions
    )
  );

  return toMerge.reduce(mergeOptions) as WatchQueryOptions<TVariables, TData>;
}

function setResult<TData, TVariables extends OperationVariables>(
  nextResult: ApolloQueryResult<TData>,
  forceUpdate: () => void,
  internalState: InternalState<TData, TVariables>,
  callbacks: Callbacks<TData>
) {
  const previousResult = internalState.result;
  if (previousResult && previousResult.data) {
    internalState.previousData = previousResult.data;
  }
  internalState.result = toQueryResult(
    unsafeHandlePartialRefetch(nextResult, internalState),
    internalState
  );
  // Calling state.setResult always triggers an update, though some call sites
  // perform additional equality checks before committing to an update.
  forceUpdate();
  handleErrorOrCompleted(
    nextResult,
    previousResult?.[originalResult],
    callbacks
  );
}

function handleErrorOrCompleted<TData, TVariables extends OperationVariables>(
  result: ApolloQueryResult<TData>,
  previousResult: ApolloQueryResult<TData> | undefined,
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
          previousResult?.networkStatus !== result.networkStatus &&
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

function getCurrentResult<TData, TVariables extends OperationVariables>(
  internalState: InternalState<TData, TVariables>,
  callbacks: Callbacks<TData>
): QueryResult<TData, TVariables> {
  // Using this.result as a cache ensures getCurrentResult continues returning
  // the same (===) result object, unless state.setResult has been called, or
  // we're doing server rendering and therefore override the result below.
  if (!internalState.result) {
    // WARNING: SIDE-EFFECTS IN THE RENDER FUNCTION
    // this could call unsafeHandlePartialRefetch
    setResult(
      internalState.observable.getCurrentResult(),
      () => {},
      internalState,
      callbacks
    );
  }
  return internalState.result!;
}

export function getDefaultFetchPolicy<
  TData,
  TVariables extends OperationVariables,
>(
  queryHookDefaultOptions?: Partial<WatchQueryOptions<TVariables, TData>>,
  clientDefaultOptions?: DefaultOptions
): WatchQueryFetchPolicy {
  return (
    queryHookDefaultOptions?.fetchPolicy ||
    clientDefaultOptions?.watchQuery?.fetchPolicy ||
    "cache-first"
  );
}

function toApolloError<TData>(
  result: ApolloQueryResult<TData>
): ApolloError | undefined {
  return isNonEmptyArray(result.errors) ?
      new ApolloError({ graphQLErrors: result.errors })
    : result.error;
}

export function toQueryResult<TData, TVariables extends OperationVariables>(
  result: ApolloQueryResult<TData>,
  internalState: InternalState<TData, TVariables>
): InternalQueryResult<TData, TVariables> {
  const { data, partial, ...resultWithoutPartial } = result;
  const queryResult: InternalQueryResult<TData, TVariables> = {
    data, // Ensure always defined, even if result.data is missing.
    ...resultWithoutPartial,
    ...internalState.obsQueryFields,
    client: internalState.client,
    observable: internalState.observable,
    variables: internalState.observable.variables,
    called: !internalState.queryHookOptions.skip,
    previousData: internalState.previousData,
  } satisfies QueryResult<TData, TVariables> as InternalQueryResult<
    TData,
    TVariables
  >;
  // non-enumerable property to hold the original result, for referential equality checks
  Object.defineProperty(queryResult, originalResult, { value: result });

  if (!queryResult.error && isNonEmptyArray(result.errors)) {
    // Until a set naming convention for networkError and graphQLErrors is
    // decided upon, we map errors (graphQLErrors) to the error options.
    // TODO: Is it possible for both result.error and result.errors to be
    // defined here?
    queryResult.error = new ApolloError({ graphQLErrors: result.errors });
  }

  return queryResult;
}

function unsafeHandlePartialRefetch<
  TData,
  TVariables extends OperationVariables,
>(
  result: ApolloQueryResult<TData>,
  internalState: InternalState<TData, TVariables>
): ApolloQueryResult<TData> {
  // TODO: This code should be removed when the partialRefetch option is
  // removed. I was unable to get this hook to behave reasonably in certain
  // edge cases when this block was put in an effect.
  if (
    result.partial &&
    internalState.queryHookOptions.partialRefetch &&
    !result.loading &&
    (!result.data || Object.keys(result.data).length === 0) &&
    internalState.observable.options.fetchPolicy !== "cache-only"
  ) {
    internalState.observable.refetch();
    return {
      ...result,
      loading: true,
      networkStatus: NetworkStatus.refetch,
    };
  }
  return result;
}

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
