import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim/index.js';
import { equal } from '@wry/equality';

import { mergeOptions, OperationVariables } from '../../core';
import { ApolloContextValue, getApolloContext } from '../context';
import { ApolloError } from '../../errors';
import {
  ApolloClient,
  ApolloQueryResult,
  NetworkStatus,
  ObservableQuery,
  DocumentNode,
  TypedDocumentNode,
  WatchQueryOptions,
} from '../../core';
import {
  QueryHookOptions,
  QueryResult,
  ObservableQueryFields,
} from '../types/types';

import { DocumentType, verifyDocumentType } from '../parser';
import { useApolloClient } from './useApolloClient';
import { canUseWeakMap, isNonEmptyArray, maybeDeepFreeze } from '../../utilities';

const {
  prototype: {
    hasOwnProperty,
  },
} = Object;

export function useQuery<
  TData = any,
  TVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: QueryHookOptions<TData, TVariables> = Object.create(null),
): QueryResult<TData, TVariables> {
  return useInternalState(
    useApolloClient(options.client),
    query,
  ).useQuery(options);
}

export function useInternalState<TData, TVariables>(
  client: ApolloClient<any>,
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
): InternalState<TData, TVariables> {
  const stateRef = useRef<InternalState<TData, TVariables>>();
  if (
    !stateRef.current ||
    client !== stateRef.current.client ||
    query !== stateRef.current.query
  ) {
    stateRef.current = new InternalState(client, query);
  }
  const state = stateRef.current;

  // By default, InternalState.prototype.forceUpdate is an empty function, but
  // we replace it here (before anyone has had a chance to see this state yet)
  // with a function that unconditionally forces an update, using the latest
  // setTick function. Updating this state by calling state.forceUpdate is the
  // only way we trigger React component updates (no other useState calls within
  // the InternalState class).
  const [_tick, setTick] = useState(0);
  state.forceUpdate = () => {
    setTick(tick => tick + 1);
  };

  return state;
}

class InternalState<TData, TVariables> {
  constructor(
    public readonly client: ReturnType<typeof useApolloClient>,
    public readonly query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ) {
    verifyDocumentType(query, DocumentType.Query);
  }

  forceUpdate() {
    // Replaced (in useInternalState) with a method that triggers an update.
  }

  // Methods beginning with use- should be called according to the standard
  // rules of React hooks: only at the top level of the calling function, and
  // without any dynamic conditional logic.
  useQuery(options: QueryHookOptions<TData, TVariables>) {
    // The renderPromises field gets initialized here in the useQuery method, at
    // the beginning of everything (for a given component rendering, at least),
    // so we can safely use this.renderPromises in other/later InternalState
    // methods without worrying it might be uninitialized. Even after
    // initialization, this.renderPromises is usually undefined (unless SSR is
    // happening), but that's fine as long as it has been initialized that way,
    // rather than left uninitialized.
    this.renderPromises = useContext(getApolloContext()).renderPromises;

    this.useOptions(options);

    const obsQuery = this.useObservableQuery();

    const result = useSyncExternalStore(
      useCallback(() => {
        if (this.renderPromises) {
          return () => {};
        }

        const onNext = () => {
          const previousResult = this.result;
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

          this.setResult(result);
        };

        const onError = (error: Error) => {
          const last = obsQuery["last"];
          subscription.unsubscribe();
          // Unfortunately, if `lastError` is set in the current
          // `observableQuery` when the subscription is re-created,
          // the subscription will immediately receive the error, which will
          // cause it to terminate again. To avoid this, we first clear
          // the last error/result from the `observableQuery` before re-starting
          // the subscription, and restore it afterwards (so the subscription
          // has a chance to stay open).
          try {
            obsQuery.resetLastResults();
            subscription = obsQuery.subscribe(onNext, onError);
          } finally {
            obsQuery["last"] = last;
          }

          if (!hasOwnProperty.call(error, 'graphQLErrors')) {
            // The error is not a GraphQL error
            throw error;
          }

          const previousResult = this.result;
          if (
            !previousResult ||
            (previousResult && previousResult.loading) ||
            !equal(error, previousResult.error)
          ) {
            this.setResult({
              data: (previousResult && previousResult.data) as TData,
              error: error as ApolloError,
              loading: false,
              networkStatus: NetworkStatus.error,
            });
          }
        };

        let subscription = obsQuery.subscribe(onNext, onError);

        return () => subscription.unsubscribe();
      }, [
        // We memoize the subscribe function using useCallback and the following
        // dependency keys, because the subscribe function reference is all that
        // useSyncExternalStore uses internally as a dependency key for the
        // useEffect ultimately responsible for the subscription, so we are
        // effectively passing this dependency array to that useEffect buried
        // inside useSyncExternalStore, as desired.
        obsQuery,
        this.renderPromises,
        this.client.disableNetworkFetches,
      ]),

      () => this.getCurrentResult(),
      () => this.getCurrentResult(),
    );

    // TODO Remove this method when we remove support for options.partialRefetch.
    this.unsafeHandlePartialRefetch(result);

    return this.toQueryResult(result);
  }

  // These members (except for renderPromises) are all populated by the
  // useOptions method, which is called unconditionally at the beginning of the
  // useQuery method, so we can safely use these members in other/later methods
  // without worrying they might be uninitialized.
  private renderPromises: ApolloContextValue["renderPromises"];
  private queryHookOptions: QueryHookOptions<TData, TVariables>;
  private watchQueryOptions: WatchQueryOptions<TVariables, TData>;

  private useOptions(
    options: QueryHookOptions<TData, TVariables>,
  ) {
    const watchQueryOptions = this.createWatchQueryOptions(
      this.queryHookOptions = options,
    );

    // Update this.watchQueryOptions, but only when they have changed, which
    // allows us to depend on the referential stability of
    // this.watchQueryOptions elsewhere.
    const currentWatchQueryOptions = this.watchQueryOptions;
    if (!equal(watchQueryOptions, currentWatchQueryOptions)) {
      this.watchQueryOptions = watchQueryOptions;
      if (currentWatchQueryOptions && this.observable) {
        // Though it might be tempting to postpone this reobserve call to the
        // useEffect block, we need getCurrentResult to return an appropriate
        // loading:true result synchronously (later within the same call to
        // useQuery). Since we already have this.observable here (not true for
        // the very first call to useQuery), we are not initiating any new
        // subscriptions, though it does feel less than ideal that reobserve
        // (potentially) kicks off a network request (for example, when the
        // variables have changed), which is technically a side-effect.
        this.observable.reobserve(watchQueryOptions);
        this.previousData = this.result?.data || this.previousData;
        this.result = void 0;
      }
    }

    // Make sure state.onCompleted and state.onError always reflect the latest
    // options.onCompleted and options.onError callbacks provided to useQuery,
    // since those functions are often recreated every time useQuery is called.
    // Like the forceUpdate method, the versions of these methods inherited from
    // InternalState.prototype are empty no-ops, but we can override them on the
    // base state object (without modifying the prototype).
    this.onCompleted = options.onCompleted || InternalState.prototype.onCompleted;
    this.onError = options.onError || InternalState.prototype.onError;

    if (
      (this.renderPromises || this.client.disableNetworkFetches) &&
      this.queryHookOptions.ssr === false
    ) {
      // If SSR has been explicitly disabled, and this function has been called
      // on the server side, return the default loading state.
      this.result = this.ssrDisabledResult;
    } else if (
      this.queryHookOptions.skip ||
      this.watchQueryOptions.fetchPolicy === 'standby'
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
      this.result = this.skipStandbyResult;
    } else if (
      this.result === this.ssrDisabledResult ||
      this.result === this.skipStandbyResult
    ) {
      this.result = void 0;
    }
  }

  private ssrDisabledResult = maybeDeepFreeze({
    loading: true,
    data: void 0 as unknown as TData,
    error: void 0,
    networkStatus: NetworkStatus.loading,
  });

  private skipStandbyResult = maybeDeepFreeze({
    loading: false,
    data: void 0 as unknown as TData,
    error: void 0,
    networkStatus: NetworkStatus.ready,
  });

  // A function to massage options before passing them to ObservableQuery.
  private createWatchQueryOptions({
    skip,
    ssr,
    onCompleted,
    onError,
    displayName,
    defaultOptions,
    // The above options are useQuery-specific, so this ...otherOptions spread
    // makes otherOptions almost a WatchQueryOptions object, except for the
    // query property that we add below.
    ...otherOptions
  }: QueryHookOptions<TData, TVariables> = {}): WatchQueryOptions<TVariables, TData> {
    // We use the mergeOptions helper function (which uses compact(...) and
    // shallow-merges variables) to combine globalDefaults with any local
    // defaultOptions provided to useQuery.
    const toMerge: Partial<WatchQueryOptions<TVariables, TData>>[] = [];

    // Merge global client.watchQuery default options with the lowest priority.
    const globalDefaults = this.client.defaultOptions.watchQuery;
    if (globalDefaults) toMerge.push(globalDefaults);

    // Next, merge any defaultOptions passed directly to useQuery.
    if (defaultOptions) toMerge.push(defaultOptions);

    const latestOptions = this.observable && this.observable.options;
    if (latestOptions && toMerge.length) {
      // If we already have this.watchQueryOptions, those options should take
      // precedence over default options of the same name. It might be simpler
      // to do toMerge.push(this.watchQueryOptions), but that potentially
      // (re)injects unrelated/unwanted options. Passing Object.create(null) as
      // the second argument to toMerge.reduce ensures the result is a newly
      // created object, so we can safely modify it in the forEach loop below.
      const defaults = toMerge.reduce(mergeOptions, Object.create(null));

      // Compact the toMerge array to hold only the merged defaults. This is
      // equivalent to toMerge.splice(0, toMerge.length, defaults).
      toMerge.length = 1;
      toMerge[0] = defaults;

      Object.keys(defaults).forEach(
        (defaultOptionName: keyof WatchQueryOptions<TVariables, TData>) => {
          const currentOptionValue = latestOptions[defaultOptionName];
          if (
            hasOwnProperty.call(latestOptions, defaultOptionName) &&
            !equal(defaults[defaultOptionName], currentOptionValue)
          ) {
            // If you keep passing useQuery({ defaultOptions: { variables }}),
            // those default variables continue to provide their default values
            // every time, though in most cases this.watchQueryOptions.variables
            // will have a current value for every default variable name, so the
            // defaults don't matter. However, if a variable has been removed
            // from this.watchQueryOptions.variables, future useQuery calls can
            // restore its default value from defaultOptions.variables.
            defaults[defaultOptionName] = defaultOptionName === "variables"
              ? { ...defaults.variables, ...currentOptionValue }
              : currentOptionValue;
          }
        },
      );
    }

    // Give highest precedence to any non-default WatchQueryOptions passed
    // directly to useQuery.
    toMerge.push(otherOptions);

    const merged = toMerge.reduce(mergeOptions, Object.create(null));

    // This Object.assign is safe because merged is the fresh object created by
    // the Object.create(null) argument to toMerge.reduce.
    const watchQueryOptions: WatchQueryOptions<TVariables, TData> =
      Object.assign(merged, { query: this.query });

    if (
      this.renderPromises &&
      (
        watchQueryOptions.fetchPolicy === 'network-only' ||
        watchQueryOptions.fetchPolicy === 'cache-and-network'
      )
    ) {
      // this behavior was added to react-apollo without explanation in this PR
      // https://github.com/apollographql/react-apollo/pull/1579
      watchQueryOptions.fetchPolicy = 'cache-first';
    } else if (!watchQueryOptions.fetchPolicy) {
      // We applied all available fetchPolicy default values above (from
      // globalDefaults and defaultOptions), so, if fetchPolicy is still
      // undefined, fall back to the default default (no typo), cache-first.
      watchQueryOptions.fetchPolicy = 'cache-first';
    }

    if (skip) {
      const {
        // The watchQueryOptions.initialFetchPolicy field usually defaults to
        // watchQueryOptions.fetchPolicy, which has now been properly
        // defaulted/initialized. However, watchQueryOptions.initialFetchPolicy
        // can be provided explicitly instead, if more control is desired.
        initialFetchPolicy = watchQueryOptions.fetchPolicy,
      } = watchQueryOptions;

      // When skipping, we set watchQueryOptions.fetchPolicy initially to
      // "standby", but we also need/want to preserve the initial non-standby
      // fetchPolicy that would have been used if not skipping.
      Object.assign(watchQueryOptions, {
        initialFetchPolicy,
        fetchPolicy: 'standby',
      });
    }

    if (!watchQueryOptions.variables) {
      watchQueryOptions.variables = {} as TVariables;
    }

    return watchQueryOptions;
  }

  // Defining these methods as no-ops on the prototype allows us to call
  // state.onCompleted and/or state.onError without worrying about whether a
  // callback was provided.
  private onCompleted(data: TData) {}
  private onError(error: ApolloError) {}

  private observable: ObservableQuery<TData, TVariables>;
  private obsQueryFields: Omit<
    ObservableQueryFields<TData, TVariables>,
    "variables"
  >;

  private useObservableQuery() {
    // See if there is an existing observable that was used to fetch the same
    // data and if so, use it instead since it will contain the proper queryId
    // to fetch the result set. This is used during SSR.
    const obsQuery = this.observable =
      this.renderPromises
        && this.renderPromises.getSSRObservable(this.watchQueryOptions)
        || this.observable // Reuse this.observable if possible (and not SSR)
        || this.client.watchQuery({
          ...this.watchQueryOptions,
        });

    this.obsQueryFields = useMemo(() => ({
      refetch: obsQuery.refetch.bind(obsQuery),
      reobserve: obsQuery.reobserve.bind(obsQuery),
      fetchMore: obsQuery.fetchMore.bind(obsQuery),
      updateQuery: obsQuery.updateQuery.bind(obsQuery),
      startPolling: obsQuery.startPolling.bind(obsQuery),
      stopPolling: obsQuery.stopPolling.bind(obsQuery),
      subscribeToMore: obsQuery.subscribeToMore.bind(obsQuery),
    }), [obsQuery]);

    if (this.renderPromises) {
      this.renderPromises.registerSSRObservable(obsQuery);

      const ssrAllowed = !(
        this.queryHookOptions.ssr === false ||
        this.queryHookOptions.skip
      );

      if (ssrAllowed && obsQuery.getCurrentResult().loading) {
        // TODO: This is a legacy API which could probably be cleaned up
        this.renderPromises.addObservableQueryPromise(obsQuery);
      }
    }

    return obsQuery;
  }

  // These members are populated by getCurrentResult and setResult, and it's
  // okay/normal for them to be initially undefined.
  private result: undefined | ApolloQueryResult<TData>;
  private previousData: undefined | TData;

  private setResult(nextResult: ApolloQueryResult<TData>) {
    const previousResult = this.result;
    if (previousResult && previousResult.data) {
      this.previousData = previousResult.data;
    }
    this.result = nextResult;
    // Calling state.setResult always triggers an update, though some call sites
    // perform additional equality checks before committing to an update.
    this.forceUpdate();
    this.handleErrorOrCompleted(nextResult);
  }

  private handleErrorOrCompleted(result: ApolloQueryResult<TData>) {
    if (!result.loading) {
      if (result.error) {
        this.onError(result.error);
      } else if (result.data) {
        this.onCompleted(result.data);
      }
    }
  }

  private getCurrentResult(): ApolloQueryResult<TData> {
    // Using this.result as a cache ensures getCurrentResult continues returning
    // the same (===) result object, unless state.setResult has been called, or
    // we're doing server rendering and therefore override the result below.
    if (!this.result) {
      this.handleErrorOrCompleted(
        this.result = this.observable.getCurrentResult()
      );
    }
    return this.result;
  }

  // This cache allows the referential stability of this.result (as returned by
  // getCurrentResult) to translate into referential stability of the resulting
  // QueryResult object returned by toQueryResult.
  private toQueryResultCache = new (canUseWeakMap ? WeakMap : Map)<
    ApolloQueryResult<TData>,
    QueryResult<TData, TVariables>
  >();

  toQueryResult(
    result: ApolloQueryResult<TData>,
  ): QueryResult<TData, TVariables> {
    let queryResult = this.toQueryResultCache.get(result);
    if (queryResult) return queryResult;

    const { data, partial, ...resultWithoutPartial } = result;
    this.toQueryResultCache.set(result, queryResult = {
      data, // Ensure always defined, even if result.data is missing.
      ...resultWithoutPartial,
      ...this.obsQueryFields,
      client: this.client,
      observable: this.observable,
      variables: this.observable.variables,
      called: true,
      previousData: this.previousData,
    });

    if (!queryResult.error && isNonEmptyArray(result.errors)) {
      // Until a set naming convention for networkError and graphQLErrors is
      // decided upon, we map errors (graphQLErrors) to the error options.
      // TODO: Is it possible for both result.error and result.errors to be
      // defined here?
      queryResult.error = new ApolloError({ graphQLErrors: result.errors });
    }

    return queryResult;
  }

  private unsafeHandlePartialRefetch(result: ApolloQueryResult<TData>) {
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
      this.observable.options.fetchPolicy !== 'cache-only'
    ) {
      Object.assign(result, {
        loading: true,
        networkStatus: NetworkStatus.refetch,
      });
      this.observable.refetch();
    }
  }
}
