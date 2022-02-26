import {
  useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { equal } from '@wry/equality';
import { OperationVariables } from '../../core';
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
import { canUseWeakMap, isNonEmptyArray } from '../../utilities';

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
  options?: QueryHookOptions<TData, TVariables>,
): QueryResult<TData, TVariables> {
  return useInternalState(
    useApolloClient(options && options.client),
    query,
  ).useQuery(options);
}

function useInternalState<TData, TVariables>(
  client: ApolloClient<any>,
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
) {
  // Return/recycle an InternalState object appropriate for this client and
  // query (and this component). If either of these inputs changes, we trigger
  // an update in the useEffect below.
  const state = useMemo(
    () => new InternalState(client, query),
    [client, query],
  );

  // Updating this state wrapper is the only way we trigger React component
  // updates (no other useState calls within the InternalState class).
  const [stateWrapper, setStateWrapper] = useState({ state });

  // By default, InternalState.prototype.forceUpdate is an empty function, but
  // we replace it here (before anyone has had a chance to see this state yet)
  // with a function that unconditionally forces an update, using the latest
  // setStateWrapper function.
  state.forceUpdate = () => {
    // Changing the stateWrapper object reference without changing
    // stateWrapper.state makes setStateWrapper trigger an update even when the
    // state is not really changing, which gives us more control over updates.
    setStateWrapper({ state: stateWrapper.state });
  };

  // In case the client and query have changed since the previous render (so we
  // have a new state and stateWrapper.state is out of date), trigger a
  // setStateWrapper update using an effect. This may not be the most elegant
  // way to maintain this state, but at least it's confined to useInternalState.
  useEffect(() => {
    if (state !== stateWrapper.state) {
      setStateWrapper({ state });
    }
  }, [state, stateWrapper.state]);

  return state;
}

class InternalState<TData, TVariables> {
  constructor(
    public readonly client: ReturnType<typeof useApolloClient>,
    public readonly query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ) {
    verifyDocumentType(query, DocumentType.Query);
  }

  public forceUpdate() {
    // Replaced (in useInternalState) with a method that triggers an update.
  }

  // Methods beginning with use- should be called according to the standard
  // rules of React hooks: only at the top level of the calling function, and
  // without any dynamic conditional logic.
  public useQuery(options: undefined | QueryHookOptions<TData, TVariables>) {
    this.useOptions(options);

    const obsQuery = this.useObservableQuery();
    this.useSubscriptionEffect(obsQuery);

    const result = this.getCurrentResult();

    // TODO Remove this method when we remove support for options.partialRefetch.
    this.unsafeHandlePartialRefetch(result);

    return this.toQueryResult(result);
  }

  // These members are all populated by the useOptions method, which is called
  // unconditionally at the beginning of the useQuery method, so we can safely
  // use these members in other/later methods without worrying about the
  // possibility they might be undefined.
  private renderPromises: ApolloContextValue["renderPromises"];
  private queryHookOptions: QueryHookOptions<TData, TVariables>;
  private watchQueryOptions: WatchQueryOptions<TVariables, TData>;
  private ssrDisabled: boolean;

  private useOptions(
    options: undefined | QueryHookOptions<TData, TVariables>,
  ): this {
    this.renderPromises = useContext(getApolloContext()).renderPromises;

    const watchQueryOptions = this.createWatchQueryOptions(
      this.queryHookOptions = options || {},
    );
    // Update this.watchQueryOptions, but only when they have changed, which
    // allows us to depend on the referential stability of
    // this.watchQueryOptions elsewhere.
    if (!equal(watchQueryOptions, this.watchQueryOptions)) {
      this.watchQueryOptions = watchQueryOptions;
    }

    this.ssrDisabled = Boolean(options && (
      options.ssr === false ||
      options.skip
    ));

    // Make sure state.onCompleted and state.onError always reflect the latest
    // options.onCompleted and options.onError callbacks provided to useQuery,
    // since those functions are often recreated every time useQuery is called.
    // Like the forceUpdate method, the versions of these methods inherited from
    // InternalState.prototype are empty no-ops, but we can override them on the
    // base state object (without modifying the prototype).

    this.onCompleted = options
      && options.onCompleted
      || InternalState.prototype.onCompleted;

    this.onError = options
      && options.onError
      || InternalState.prototype.onError;

    return this;
  }

  // A function to massage options before passing them to ObservableQuery.
  private createWatchQueryOptions<TData, TVariables>({
    skip,
    ssr,
    onCompleted,
    onError,
    displayName,
    // The above options are useQuery-specific, so this ...otherOptions spread
    // makes otherOptions almost a WatchQueryOptions object, except for the
    // query property that we add below.
    ...otherOptions
  }: QueryHookOptions<TData, TVariables> = {}): WatchQueryOptions<TVariables, TData> {
    // TODO: For some reason, we pass context, which is the React Apollo Context,
    // into observable queries, and test for that.
    const watchQueryOptions: WatchQueryOptions<TVariables, TData> =
      Object.assign(otherOptions, { query: this.query });

    if (skip) {
      watchQueryOptions.fetchPolicy = 'standby';
    } else if (
      watchQueryOptions.context?.renderPromises &&
      (
        watchQueryOptions.fetchPolicy === 'network-only' ||
        watchQueryOptions.fetchPolicy === 'cache-and-network'
      )
    ) {
      // this behavior was added to react-apollo without explanation in this PR
      // https://github.com/apollographql/react-apollo/pull/1579
      watchQueryOptions.fetchPolicy = 'cache-first';
    } else if (!watchQueryOptions.fetchPolicy) {
      const defaultOptions = this.client.defaultOptions.watchQuery;
      // cache-first is the default policy, but we explicitly assign it here so
      // the cache policies computed based on options can be cleared
      watchQueryOptions.fetchPolicy =
        defaultOptions && defaultOptions.fetchPolicy || 'cache-first';
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
        || this.client.watchQuery(this.watchQueryOptions);

    this.obsQueryFields = useMemo(() => ({
      refetch: obsQuery.refetch.bind(obsQuery),
      fetchMore: obsQuery.fetchMore.bind(obsQuery),
      updateQuery: obsQuery.updateQuery.bind(obsQuery),
      startPolling: obsQuery.startPolling.bind(obsQuery),
      stopPolling: obsQuery.stopPolling.bind(obsQuery),
      subscribeToMore: obsQuery.subscribeToMore.bind(obsQuery),
    }), [obsQuery]);

    if (this.renderPromises) {
      this.renderPromises.registerSSRObservable(obsQuery);

      if (!this.ssrDisabled && obsQuery.getCurrentResult().loading) {
        // TODO: This is a legacy API which could probably be cleaned up
        this.renderPromises.addQueryPromise({
          // The only options which seem to actually be used by the
          // RenderPromises class are query and variables.
          getOptions: () => obsQuery.options,
          fetchData: () => new Promise<void>((resolve) => {
            const sub = obsQuery.subscribe({
              next(result) {
                if (!result.loading) {
                  resolve()
                  sub.unsubscribe();
                }
              },
              error() {
                resolve();
                sub.unsubscribe();
              },
              complete() {
                resolve();
              },
            });
          }),
        },
        // This callback never seemed to do anything
        () => null);

        // TODO: This is a hack to make sure useLazyQuery executions update the
        // obsevable query options for ssr.
        obsQuery.setOptions(this.watchQueryOptions).catch(() => {});
      }
    }

    const prevOptionsRef = useRef({
      watchQueryOptions: this.watchQueryOptions,
    });

    // An effect to keep obsQuery.options up to date in case
    // state.watchQueryOptions changes.
    useEffect(() => {
      if (this.renderPromises) {
        // Do nothing during server rendering.
      } else if (
        // The useOptions method only updates this.watchQueryOptions if new new
        // watchQueryOptions are not deep-equal to the previous options, so we
        // only need a reference check (!==) here.
        this.watchQueryOptions !== prevOptionsRef.current.watchQueryOptions
      ) {
        obsQuery.setOptions(this.watchQueryOptions).catch(() => {});
        prevOptionsRef.current.watchQueryOptions = this.watchQueryOptions;
        this.setResult(obsQuery.getCurrentResult());
      }
    }, [obsQuery, this.watchQueryOptions]);

    return obsQuery;
  }

  private useSubscriptionEffect(
    // We could use this.observable and not pass this obsQuery parameter, but I
    // like the guarantee that obsQuery won't change, whereas this.observable
    // could change without warning (in theory).
    obsQuery: ObservableQuery<TData, TVariables>,
  ) {
    // An effect to subscribe to the current observable query
    useEffect(() => {
      if (this.renderPromises) {
        return;
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
      obsQuery,
      this.renderPromises,
      this.client.disableNetworkFetches,
    ]);
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
    let { result } = this;
    // Using this.result as a cache ensures getCurrentResult continues returning
    // the same (===) result object, unless state.setResult has been called, or
    // we're doing server rendering and therefore override the result below.
    if (!result) {
      result = this.result = this.observable.getCurrentResult();
      this.handleErrorOrCompleted(result);
    }

    if (
      (this.renderPromises || this.client.disableNetworkFetches) &&
      this.queryHookOptions.ssr === false
    ) {
      // If SSR has been explicitly disabled, and this function has been called
      // on the server side, return the default loading state.
      result = {
        loading: true,
        data: void 0 as unknown as TData,
        error: void 0,
        networkStatus: NetworkStatus.loading,
      };
    } else if (
      this.queryHookOptions.skip ||
      this.queryHookOptions.fetchPolicy === 'standby'
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
      result = {
        loading: false,
        data: void 0 as unknown as TData,
        error: void 0,
        networkStatus: NetworkStatus.ready,
      };
    }

    return result;
  }

  // This cache allows the referential stability of this.result (as returned by
  // getCurrentResult) to translate into referential stability of the resulting
  // QueryResult object returned by toQueryResult.
  private toQueryResultCache = new (canUseWeakMap ? WeakMap : Map)<
    ApolloQueryResult<TData>,
    QueryResult<TData, TVariables>
  >();

  private toQueryResult(
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
