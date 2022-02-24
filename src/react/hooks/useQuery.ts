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
    query,
    options && options.client,
  ).useQuery(options);
}

function useInternalState<TData, TVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  clientOverride?: ApolloClient<any>,
) {
  const client = useApolloClient(clientOverride);

  const state = useMemo(
    () => new InternalState(client, query),
    [client, query],
  );

  const [stateWrapper, setStateWrapper] = useState({ state });

  state.forceUpdate = () => {
    setStateWrapper({ state: stateWrapper.state });
  };

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

  public useQuery(options: undefined | QueryHookOptions<TData, TVariables>) {
    this.useOptions(options);
    this.useObservableQuery();

    const result = this.getCurrentResult();

    // TODO Remove this method when we remove support for options.partialRefetch.
    this.unsafeHandlePartialRefetch(result);

    return this.toQueryResult(result);
  }

  private renderPromises: ApolloContextValue["renderPromises"];
  private queryHookOptions: QueryHookOptions<TData, TVariables>;
  private watchQueryOptions: WatchQueryOptions<TVariables, TData>;
  private ssrDisabled: boolean;

  private useOptions(
    options: undefined | QueryHookOptions<TData, TVariables>,
  ): this {
    this.renderPromises = useContext(getApolloContext()).renderPromises;

    const watchQueryOptions = createWatchQueryOptions(
      this.query,
      this.queryHookOptions = options || {},
      this.client.defaultOptions.watchQuery,
    );

    if (!equal(watchQueryOptions, this.watchQueryOptions)) {
      this.watchQueryOptions = watchQueryOptions;
    }

    this.ssrDisabled = Boolean(options && (
      options.ssr === false ||
      options.skip
    ));

    this.onCompleted = options
      && options.onCompleted
      || InternalState.prototype.onCompleted;

    this.onError = options
      && options.onError
      || InternalState.prototype.onError;

    return this;
  }

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
        || this.observable
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

    this.useSubscriptionEffect();

    return obsQuery;
  }

  private useSubscriptionEffect() {
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
        const result = this.observable.getCurrentResult();
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
        const last = this.observable["last"];
        subscription.unsubscribe();
        // Unfortunately, if `lastError` is set in the current
        // `observableQuery` when the subscription is re-created,
        // the subscription will immediately receive the error, which will
        // cause it to terminate again. To avoid this, we first clear
        // the last error/result from the `observableQuery` before re-starting
        // the subscription, and restore it afterwards (so the subscription
        // has a chance to stay open).
        try {
          this.observable.resetLastResults();
          subscription = this.observable.subscribe(onNext, onError);
        } finally {
          this.observable["last"] = last;
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

      let subscription = this.observable.subscribe(onNext, onError);

      return () => subscription.unsubscribe();
    }, [
      this.observable,
      this.renderPromises,
      this.client.disableNetworkFetches,
    ]);
  }

  private result: undefined | ApolloQueryResult<TData>;
  private previousData: undefined | TData;

  private setResult(nextResult: ApolloQueryResult<TData>) {
    const previousResult = this.result;
    if (previousResult && previousResult.data) {
      this.previousData = previousResult.data;
    }

    this.result = nextResult;
    this.forceUpdate();

    if (!nextResult.loading) {
      if (nextResult.error) {
        this.onError(nextResult.error);
      } else if (nextResult.data) {
        this.onCompleted(nextResult.data);
      }
    }
  }

  private getCurrentResult(): ApolloQueryResult<TData> {
    let { result } = this;
    if (!result) {
      result = this.result = this.observable.getCurrentResult();
      if (!result.loading) {
        if (result.error) {
          this.onError(result.error);
        } else if (result.data) {
          this.onCompleted(result.data);
        }
      }
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

/**
 * A function to massage options before passing them the ObservableQuery.
 */
function createWatchQueryOptions<TData, TVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  { skip,
    ssr,
    onCompleted,
    onError,
    displayName,
    // The above options are useQuery-specific, so this ...otherOptions spread
    // makes otherOptions almost a WatchQueryOptions object, except for the
    // query property that we add below.
    ...otherOptions
  }: QueryHookOptions<TData, TVariables> = {},
  defaultOptions?: Partial<WatchQueryOptions<any, any>>
): WatchQueryOptions<TVariables, TData> {
  // TODO: For some reason, we pass context, which is the React Apollo Context,
  // into observable queries, and test for that.
  const watchQueryOptions: WatchQueryOptions<TVariables, TData> =
    Object.assign(otherOptions, { query });

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
