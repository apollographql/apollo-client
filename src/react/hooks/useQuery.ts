import { invariant } from "../../utilities/globals/index.js";

import * as React from "rehackt";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
import { equal } from "@wry/equality";

import type {
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
  canUseWeakMap,
  compact,
  isNonEmptyArray,
  maybeDeepFreeze,
} from "../../utilities/index.js";
import { wrapHook } from "./internal/index.js";

const {
  prototype: { hasOwnProperty },
} = Object;

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
      internalState.observable.reobserve(internalState.getObsQueryOptions());

      // Make sure getCurrentResult returns a fresh ApolloQueryResult<TData>,
      // but save the current data as this.previousData, just like setResult
      // usually does.
      internalState.previousData =
        internalState.result?.data || internalState.previousData;
      internalState.result = void 0;
    }
  }

  // Make sure state.onCompleted and state.onError always reflect the latest
  // options.onCompleted and options.onError callbacks provided to useQuery,
  // since those functions are often recreated every time useQuery is called.
  // Like the forceUpdate method, the versions of these methods inherited from
  // InternalState.prototype are empty no-ops, but we can override them on the
  // base state object (without modifying the prototype).
  internalState.onCompleted =
    options.onCompleted || InternalState.prototype.onCompleted;
  internalState.onError = options.onError || InternalState.prototype.onError;

  if (
    (renderPromises || internalState.client.disableNetworkFetches) &&
    internalState.queryHookOptions.ssr === false &&
    !internalState.queryHookOptions.skip
  ) {
    // If SSR has been explicitly disabled, and this function has been called
    // on the server side, return the default loading state.
    internalState.result = internalState.ssrDisabledResult;
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
    internalState.result = internalState.skipStandbyResult;
  } else if (
    internalState.result === internalState.ssrDisabledResult ||
    internalState.result === internalState.skipStandbyResult
  ) {
    internalState.result = void 0;
  }

  // See if there is an existing observable that was used to fetch the same
  // data and if so, use it instead since it will contain the proper queryId
  // to fetch the result set. This is used during SSR.
  const obsQuery = (internalState.observable =
    (renderPromises &&
      renderPromises.getSSRObservable(internalState.watchQueryOptions)) ||
    internalState.observable || // Reuse this.observable if possible (and not SSR)
    internalState.client.watchQuery(internalState.getObsQueryOptions()));

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

        internalState.forceUpdate = handleStoreChange;

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

          internalState.setResult(result);
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
            internalState.setResult({
              data: (previousResult && previousResult.data) as TData,
              error: error as ApolloError,
              loading: false,
              networkStatus: NetworkStatus.error,
            });
          }
        };

        let subscription = obsQuery.subscribe(onNext, onError);

        // Do the "unsubscribe" with a short delay.
        // This way, an existing subscription can be reused without an additional
        // request if "unsubscribe"  and "resubscribe" to the same ObservableQuery
        // happen in very fast succession.
        return () => {
          setTimeout(() => subscription.unsubscribe());
          internalState.forceUpdate = () => internalState.forceUpdateState();
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

    () => internalState.getCurrentResult(),
    () => internalState.getCurrentResult()
  );

  // TODO Remove this method when we remove support for options.partialRefetch.
  internalState.unsafeHandlePartialRefetch(result);

  return internalState.toQueryResult(result);
}

export function useInternalState<TData, TVariables extends OperationVariables>(
  client: ApolloClient<any>,
  query: DocumentNode | TypedDocumentNode<TData, TVariables>
): InternalState<TData, TVariables> {
  // By default, InternalState.prototype.forceUpdate is an empty function, but
  // we replace it here (before anyone has had a chance to see this state yet)
  // with a function that unconditionally forces an update, using the latest
  // setTick function. Updating this state by calling state.forceUpdate or the
  // uSES notification callback are the only way we trigger React component updates.
  const forceUpdateState = React.useReducer((tick) => tick + 1, 0)[1];

  function createInternalState(previous?: InternalState<TData, TVariables>) {
    return Object.assign(new InternalState(client, query, previous), {
      forceUpdateState,
    });
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
function createWatchQueryOptions<
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
      fetchPolicy = internalState.getDefaultFetchPolicy(),
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
      internalState.getDefaultFetchPolicy();
  }

  return watchQueryOptions;
}

class InternalState<TData, TVariables extends OperationVariables> {
  constructor(
    public readonly client: ReturnType<typeof useApolloClient>,
    public readonly query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    previous?: InternalState<TData, TVariables>
  ) {
    verifyDocumentType(query, DocumentType.Query);

    // Reuse previousData from previous InternalState (if any) to provide
    // continuity of previousData even if/when the query or client changes.
    const previousResult = previous && previous.result;
    const previousData = previousResult && previousResult.data;
    if (previousData) {
      this.previousData = previousData;
    }
  }

  /**
   * Forces an update using local component state.
   * As this is not batched with `useSyncExternalStore` updates,
   * this is only used as a fallback if the `useSyncExternalStore` "force update"
   * method is not registered at the moment.
   * See https://github.com/facebook/react/issues/25191
   *  */
  forceUpdateState() {
    // Replaced (in useInternalState) with a method that triggers an update.
    invariant.warn(
      "Calling default no-op implementation of InternalState#forceUpdate"
    );
  }

  /**
   * Will be overwritten by the `useSyncExternalStore` "force update" method
   * whenever it is available and reset to `forceUpdateState` when it isn't.
   */
  forceUpdate = () => this.forceUpdateState();

  executeQuery(
    options: QueryHookOptions<TData, TVariables> & {
      query?: DocumentNode;
    },
    hasRenderPromises: boolean
  ) {
    if (options.query) {
      Object.assign(this, { query: options.query });
    }

    this.watchQueryOptions = createWatchQueryOptions(
      (this.queryHookOptions = options),
      this,
      hasRenderPromises
    );

    const concast = this.observable.reobserveAsConcast(
      this.getObsQueryOptions()
    );

    // Make sure getCurrentResult returns a fresh ApolloQueryResult<TData>,
    // but save the current data as this.previousData, just like setResult
    // usually does.
    this.previousData = this.result?.data || this.previousData;
    this.result = void 0;
    this.forceUpdate();

    return new Promise<QueryResult<TData, TVariables>>((resolve) => {
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
          resolve(this.toQueryResult(this.observable.getCurrentResult()));
        },
        complete: () => {
          resolve(this.toQueryResult(result));
        },
      });
    });
  }

  public queryHookOptions!: QueryHookOptions<TData, TVariables>;
  public watchQueryOptions!: WatchQueryOptions<TVariables, TData>;

  public getObsQueryOptions(): WatchQueryOptions<TVariables, TData> {
    const toMerge: Array<Partial<WatchQueryOptions<TVariables, TData>>> = [];

    const globalDefaults = this.client.defaultOptions.watchQuery;
    if (globalDefaults) toMerge.push(globalDefaults);

    if (this.queryHookOptions.defaultOptions) {
      toMerge.push(this.queryHookOptions.defaultOptions);
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
        this.observable && this.observable.options,
        this.watchQueryOptions
      )
    );

    return toMerge.reduce(mergeOptions) as WatchQueryOptions<TVariables, TData>;
  }

  public ssrDisabledResult = maybeDeepFreeze({
    loading: true,
    data: void 0 as unknown as TData,
    error: void 0,
    networkStatus: NetworkStatus.loading,
  });

  public skipStandbyResult = maybeDeepFreeze({
    loading: false,
    data: void 0 as unknown as TData,
    error: void 0,
    networkStatus: NetworkStatus.ready,
  });

  getDefaultFetchPolicy(): WatchQueryFetchPolicy {
    return (
      this.queryHookOptions.defaultOptions?.fetchPolicy ||
      this.client.defaultOptions.watchQuery?.fetchPolicy ||
      "cache-first"
    );
  }

  // Defining these methods as no-ops on the prototype allows us to call
  // state.onCompleted and/or state.onError without worrying about whether a
  // callback was provided.
  public onCompleted(data: TData) {}
  public onError(error: ApolloError) {}

  public observable!: ObservableQuery<TData, TVariables>;
  public obsQueryFields!: Omit<
    ObservableQueryFields<TData, TVariables>,
    "variables"
  >;

  // These members are populated by getCurrentResult and setResult, and it's
  // okay/normal for them to be initially undefined.
  public result: undefined | ApolloQueryResult<TData>;
  public previousData: undefined | TData;

  public setResult(nextResult: ApolloQueryResult<TData>) {
    const previousResult = this.result;
    if (previousResult && previousResult.data) {
      this.previousData = previousResult.data;
    }
    this.result = nextResult;
    // Calling state.setResult always triggers an update, though some call sites
    // perform additional equality checks before committing to an update.
    this.forceUpdate();
    this.handleErrorOrCompleted(nextResult, previousResult);
  }

  public handleErrorOrCompleted(
    result: ApolloQueryResult<TData>,
    previousResult?: ApolloQueryResult<TData>
  ) {
    if (!result.loading) {
      const error = this.toApolloError(result);

      // wait a tick in case we are in the middle of rendering a component
      Promise.resolve()
        .then(() => {
          if (error) {
            this.onError(error);
          } else if (
            result.data &&
            previousResult?.networkStatus !== result.networkStatus &&
            result.networkStatus === NetworkStatus.ready
          ) {
            this.onCompleted(result.data);
          }
        })
        .catch((error) => {
          invariant.warn(error);
        });
    }
  }

  public toApolloError(
    result: ApolloQueryResult<TData>
  ): ApolloError | undefined {
    return isNonEmptyArray(result.errors) ?
        new ApolloError({ graphQLErrors: result.errors })
      : result.error;
  }

  public getCurrentResult(): ApolloQueryResult<TData> {
    // Using this.result as a cache ensures getCurrentResult continues returning
    // the same (===) result object, unless state.setResult has been called, or
    // we're doing server rendering and therefore override the result below.
    if (!this.result) {
      this.handleErrorOrCompleted(
        (this.result = this.observable.getCurrentResult())
      );
    }
    return this.result;
  }

  // This cache allows the referential stability of this.result (as returned by
  // getCurrentResult) to translate into referential stability of the resulting
  // QueryResult object returned by toQueryResult.
  public toQueryResultCache = new (canUseWeakMap ? WeakMap : Map)<
    ApolloQueryResult<TData>,
    QueryResult<TData, TVariables>
  >();

  toQueryResult(
    result: ApolloQueryResult<TData>
  ): QueryResult<TData, TVariables> {
    let queryResult = this.toQueryResultCache.get(result);
    if (queryResult) return queryResult;

    const { data, partial, ...resultWithoutPartial } = result;
    this.toQueryResultCache.set(
      result,
      (queryResult = {
        data, // Ensure always defined, even if result.data is missing.
        ...resultWithoutPartial,
        ...this.obsQueryFields,
        client: this.client,
        observable: this.observable,
        variables: this.observable.variables,
        called: !this.queryHookOptions.skip,
        previousData: this.previousData,
      })
    );

    if (!queryResult.error && isNonEmptyArray(result.errors)) {
      // Until a set naming convention for networkError and graphQLErrors is
      // decided upon, we map errors (graphQLErrors) to the error options.
      // TODO: Is it possible for both result.error and result.errors to be
      // defined here?
      queryResult.error = new ApolloError({ graphQLErrors: result.errors });
    }

    return queryResult;
  }

  public unsafeHandlePartialRefetch(result: ApolloQueryResult<TData>) {
    // WARNING: SIDE-EFFECTS IN THE RENDER FUNCTION
    //
    // TODO: This code should be removed when the partialRefetch option is
    // removed. I was unable to get this hook to behave reasonably in certain
    // edge cases when this block was put in an effect.
    if (
      result.partial &&
      this.queryHookOptions.partialRefetch &&
      !result.loading &&
      (!result.data || Object.keys(result.data).length === 0) &&
      this.observable.options.fetchPolicy !== "cache-only"
    ) {
      Object.assign(result, {
        loading: true,
        networkStatus: NetworkStatus.refetch,
      });
      this.observable.refetch();
    }
  }
}
