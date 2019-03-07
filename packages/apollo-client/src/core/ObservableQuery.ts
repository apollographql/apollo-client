import { isEqual, tryFunctionOrLogError, cloneDeep } from 'apollo-utilities';
import { GraphQLError } from 'graphql';
import { NetworkStatus, isNetworkRequestInFlight } from './networkStatus';
import { Observable, Observer, Subscription } from '../util/Observable';
import { ApolloError } from '../errors/ApolloError';
import { QueryManager } from './QueryManager';
import { ApolloQueryResult, FetchType, OperationVariables } from './types';
import {
  ModifiableWatchQueryOptions,
  WatchQueryOptions,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  ErrorPolicy,
  UpdateQueryFn,
} from './watchQueryOptions';

import { QueryStoreValue } from '../data/queries';

import { invariant } from 'ts-invariant';

// XXX remove in the next breaking semver change (3.0)
// Deprecated, use ApolloCurrentQueryResult
export type ApolloCurrentResult<T> = {
  data: T | {};
  errors?: ReadonlyArray<GraphQLError>;
  loading: boolean;
  networkStatus: NetworkStatus;
  error?: ApolloError;
  partial?: boolean;
};

export type ApolloCurrentQueryResult<T> = {
  data: T | undefined;
  errors?: ReadonlyArray<GraphQLError>;
  loading: boolean;
  networkStatus: NetworkStatus;
  error?: ApolloError;
  partial?: boolean;
  stale?: boolean;
};

export interface FetchMoreOptions<
  TData = any,
  TVariables = OperationVariables
> {
  updateQuery: (
    previousQueryResult: TData,
    options: {
      fetchMoreResult?: TData;
      variables?: TVariables;
    },
  ) => TData;
}

export interface UpdateQueryOptions<TVariables> {
  variables?: TVariables;
}

export const hasError = (
  storeValue: QueryStoreValue,
  policy: ErrorPolicy = 'none',
) =>
  storeValue &&
  ((storeValue.graphQLErrors &&
    storeValue.graphQLErrors.length > 0 &&
    policy === 'none') ||
    storeValue.networkError);

export class ObservableQuery<
  TData = any,
  TVariables = OperationVariables
> extends Observable<ApolloQueryResult<TData>> {
  public options: WatchQueryOptions<TVariables>;
  public queryId: string;
  /**
   *
   * The current value of the variables for this query. Can change.
   */
  public variables: TVariables;

  private shouldSubscribe: boolean;
  private isTornDown: boolean;
  private queryManager: QueryManager<any>;
  private observers: Observer<ApolloQueryResult<TData>>[];
  private subscriptionHandles: Subscription[];

  private lastResult: ApolloQueryResult<TData>;
  private lastResultSnapshot: ApolloQueryResult<TData>;
  private lastError: ApolloError;

  constructor({
    queryManager,
    options,
    shouldSubscribe = true,
  }: {
    queryManager: QueryManager<any>;
    options: WatchQueryOptions<TVariables>;
    shouldSubscribe?: boolean;
  }) {
    super((observer: Observer<ApolloQueryResult<TData>>) =>
      this.onSubscribe(observer),
    );

    // active state
    this.isTornDown = false;

    // query information
    this.options = options;
    this.variables = options.variables || ({} as TVariables);
    this.queryId = queryManager.generateQueryId();
    this.shouldSubscribe = shouldSubscribe;

    // related classes
    this.queryManager = queryManager;

    // interal data stores
    this.observers = [];
    this.subscriptionHandles = [];
  }

  public result(): Promise<ApolloQueryResult<TData>> {
    const that = this;
    return new Promise((resolve, reject) => {
      let subscription: Subscription;
      const observer: Observer<ApolloQueryResult<TData>> = {
        next(result: ApolloQueryResult<TData>) {
          resolve(result);

          // Stop the query within the QueryManager if we can before
          // this function returns.
          //
          // We do this in order to prevent observers piling up within
          // the QueryManager. Notice that we only fully unsubscribe
          // from the subscription in a setTimeout(..., 0)  call. This call can
          // actually be handled by the browser at a much later time. If queries
          // are fired in the meantime, observers that should have been removed
          // from the QueryManager will continue to fire, causing an unnecessary
          // performance hit.
          if (!that.observers.some(obs => obs !== observer)) {
            that.queryManager.removeQuery(that.queryId);
          }

          setTimeout(() => {
            subscription.unsubscribe();
          }, 0);
        },
        error(error: any) {
          reject(error);
        },
      };
      subscription = that.subscribe(observer);
    });
  }

  // XXX remove in the next breaking semver change (3.0)
  // Deprecated, use getCurrentResult()
  public currentResult(): ApolloCurrentResult<TData> {
    const result = this.getCurrentResult() as ApolloCurrentResult<TData>;
    if (result.data === undefined) {
      result.data = {};
    }
    return result;
  }

  /**
   * Return the result of the query from the local cache as well as some fetching status
   * `loading` and `networkStatus` allow to know if a request is in flight
   * `partial` lets you know if the result from the local cache is complete or partial
   * @return {data: Object, error: ApolloError, loading: boolean, networkStatus: number, partial: boolean}
   */
  public getCurrentResult(): ApolloCurrentQueryResult<TData> {
    if (this.isTornDown) {
      return {
        data: this.lastError
          ? undefined
          : this.lastResult
          ? this.lastResult.data
          : undefined,
        error: this.lastError,
        loading: false,
        networkStatus: NetworkStatus.error,
      };
    }

    const queryStoreValue = this.queryManager.queryStore.get(this.queryId);

    if (hasError(queryStoreValue, this.options.errorPolicy)) {
      return {
        data: undefined,
        loading: false,
        networkStatus: queryStoreValue.networkStatus,
        error: new ApolloError({
          graphQLErrors: queryStoreValue.graphQLErrors,
          networkError: queryStoreValue.networkError,
        }),
      };
    }

    // Variables might have been added dynamically at query time, when
    // using `@client @export(as: "varname")` for example. When this happens,
    // the variables have been updated in the query store, but not updated on
    // the original `ObservableQuery`. We'll update the observable query
    // variables here to match, so retrieving from the cache doesn't fail.
    if (queryStoreValue && queryStoreValue.variables) {
      this.options.variables = Object.assign(
        {},
        this.options.variables,
        queryStoreValue.variables,
      );
    }

    const { data, partial } = this.queryManager.getCurrentQueryResult(this);

    const queryLoading =
      !queryStoreValue ||
      queryStoreValue.networkStatus === NetworkStatus.loading;

    // We need to be careful about the loading state we show to the user, to try
    // and be vaguely in line with what the user would have seen from .subscribe()
    // but to still provide useful information synchronously when the query
    // will not end up hitting the server.
    // See more: https://github.com/apollostack/apollo-client/issues/707
    // Basically: is there a query in flight right now (modolo the next tick)?
    const loading =
      (this.options.fetchPolicy === 'network-only' && queryLoading) ||
      (partial && this.options.fetchPolicy !== 'cache-only');

    // if there is nothing in the query store, it means this query hasn't fired yet or it has been cleaned up. Therefore the
    // network status is dependent on queryLoading.
    let networkStatus: NetworkStatus;
    if (queryStoreValue) {
      networkStatus = queryStoreValue.networkStatus;
    } else {
      networkStatus = loading ? NetworkStatus.loading : NetworkStatus.ready;
    }

    const result = {
      data,
      loading: isNetworkRequestInFlight(networkStatus),
      networkStatus,
    } as ApolloQueryResult<TData>;

    if (
      queryStoreValue &&
      queryStoreValue.graphQLErrors &&
      this.options.errorPolicy === 'all'
    ) {
      result.errors = queryStoreValue.graphQLErrors;
    }

    if (!partial) {
      this.lastResult = { ...result, stale: false };
      this.lastResultSnapshot = this.queryManager.assumeImmutableResults
        ? this.lastResult : cloneDeep(this.lastResult);
    }

    return { ...result, partial };
  }

  // Compares newResult to the snapshot we took of this.lastResult when it was
  // first received.
  public isDifferentFromLastResult(newResult: ApolloQueryResult<TData>) {
    const { lastResultSnapshot: snapshot } = this;
    return !(
      snapshot &&
      newResult &&
      snapshot.networkStatus === newResult.networkStatus &&
      snapshot.stale === newResult.stale &&
      isEqual(snapshot.data, newResult.data)
    );
  }

  // Returns the last result that observer.next was called with. This is not the same as
  // getCurrentResult! If you're not sure which you need, then you probably need getCurrentResult.
  public getLastResult(): ApolloQueryResult<TData> {
    return this.lastResult;
  }

  public getLastError(): ApolloError {
    return this.lastError;
  }

  public resetLastResults(): void {
    delete this.lastResult;
    delete this.lastResultSnapshot;
    delete this.lastError;
    this.isTornDown = false;
  }

  /**
   * Update the variables of this observable query, and fetch the new results.
   * This method should be preferred over `setVariables` in most use cases.
   *
   * @param variables: The new set of variables. If there are missing variables,
   * the previous values of those variables will be used.
   */
  public refetch(variables?: TVariables): Promise<ApolloQueryResult<TData>> {
    const { fetchPolicy } = this.options;
    // early return if trying to read from cache during refetch
    if (fetchPolicy === 'cache-only') {
      return Promise.reject(
        new Error(
          'cache-only fetchPolicy option should not be used together with query refetch.',
        ),
      );
    }

    if (!isEqual(this.variables, variables)) {
      // update observable variables
      this.variables = Object.assign({}, this.variables, variables);
    }

    if (!isEqual(this.options.variables, this.variables)) {
      // Update the existing options with new variables
      this.options.variables = Object.assign(
        {},
        this.options.variables,
        this.variables,
      );
    }

    // Override fetchPolicy for this call only
    // only network-only and no-cache are safe to use
    const isNetworkFetchPolicy =
      fetchPolicy === 'network-only' || fetchPolicy === 'no-cache';

    const combinedOptions: WatchQueryOptions = {
      ...this.options,
      fetchPolicy: isNetworkFetchPolicy ? fetchPolicy : 'network-only',
    };

    return this.queryManager
      .fetchQuery(this.queryId, combinedOptions, FetchType.refetch)
      .then(result => result as ApolloQueryResult<TData>);
  }

  public fetchMore<K extends keyof TVariables>(
    fetchMoreOptions: FetchMoreQueryOptions<TVariables, K> &
      FetchMoreOptions<TData, TVariables>,
  ): Promise<ApolloQueryResult<TData>> {
    // early return if no update Query
    invariant(
      fetchMoreOptions.updateQuery,
      'updateQuery option is required. This function defines how to update the query data with the new results.',
    );

    let combinedOptions: any;

    return Promise.resolve()
      .then(() => {
        const qid = this.queryManager.generateQueryId();

        if (fetchMoreOptions.query) {
          // fetch a new query
          combinedOptions = fetchMoreOptions;
        } else {
          // fetch the same query with a possibly new variables
          combinedOptions = {
            ...this.options,
            ...fetchMoreOptions,
            variables: Object.assign(
              {},
              this.variables,
              fetchMoreOptions.variables,
            ),
          };
        }

        combinedOptions.fetchPolicy = 'network-only';

        return this.queryManager.fetchQuery(
          qid,
          combinedOptions as WatchQueryOptions,
          FetchType.normal,
          this.queryId,
        );
      })
      .then(fetchMoreResult => {
        this.updateQuery((previousResult: any) =>
          fetchMoreOptions.updateQuery(previousResult, {
            fetchMoreResult: fetchMoreResult.data as TData,
            variables: combinedOptions.variables,
          }),
        );

        return fetchMoreResult as ApolloQueryResult<TData>;
      });
  }

  // XXX the subscription variables are separate from the query variables.
  // if you want to update subscription variables, right now you have to do that separately,
  // and you can only do it by stopping the subscription and then subscribing again with new variables.
  public subscribeToMore<TSubscriptionData = TData>(
    options: SubscribeToMoreOptions<TData, TVariables, TSubscriptionData>,
  ) {
    const subscription = this.queryManager
      .startGraphQLSubscription({
        query: options.document,
        variables: options.variables,
      })
      .subscribe({
        next: (subscriptionData: { data: TSubscriptionData }) => {
          if (options.updateQuery) {
            this.updateQuery((previous, { variables }) =>
              (options.updateQuery as UpdateQueryFn<
                TData,
                TVariables,
                TSubscriptionData
              >)(previous, {
                subscriptionData,
                variables,
              }),
            );
          }
        },
        error: (err: any) => {
          if (options.onError) {
            options.onError(err);
            return;
          }
          invariant.error('Unhandled GraphQL subscription error', err);
        },
      });

    this.subscriptionHandles.push(subscription);

    return () => {
      const i = this.subscriptionHandles.indexOf(subscription);
      if (i >= 0) {
        this.subscriptionHandles.splice(i, 1);
        subscription.unsubscribe();
      }
    };
  }

  // Note: if the query is not active (there are no subscribers), the promise
  // will return null immediately.
  public setOptions(
    opts: ModifiableWatchQueryOptions,
  ): Promise<ApolloQueryResult<TData>> {
    const oldOptions = this.options;
    this.options = Object.assign({}, this.options, opts) as WatchQueryOptions<
      TVariables
    >;

    if (opts.pollInterval) {
      this.startPolling(opts.pollInterval);
    } else if (opts.pollInterval === 0) {
      this.stopPolling();
    }

    // If fetchPolicy went from cache-only to something else, or from something else to network-only
    const tryFetch: boolean =
      (oldOptions.fetchPolicy !== 'network-only' &&
        opts.fetchPolicy === 'network-only') ||
      (oldOptions.fetchPolicy === 'cache-only' &&
        opts.fetchPolicy !== 'cache-only') ||
      (oldOptions.fetchPolicy === 'standby' &&
        opts.fetchPolicy !== 'standby') ||
      false;

    return this.setVariables(
      this.options.variables as TVariables,
      tryFetch,
      opts.fetchResults,
    );
  }

  /**
   * This is for *internal* use only. Most users should instead use `refetch`
   * in order to be properly notified of results even when they come from cache.
   *
   * Update the variables of this observable query, and fetch the new results
   * if they've changed. If you want to force new results, use `refetch`.
   *
   * Note: the `next` callback will *not* fire if the variables have not changed
   * or if the result is coming from cache.
   *
   * Note: the promise will return the old results immediately if the variables
   * have not changed.
   *
   * Note: the promise will return null immediately if the query is not active
   * (there are no subscribers).
   *
   * @private
   *
   * @param variables: The new set of variables. If there are missing variables,
   * the previous values of those variables will be used.
   *
   * @param tryFetch: Try and fetch new results even if the variables haven't
   * changed (we may still just hit the store, but if there's nothing in there
   * this will refetch)
   *
   * @param fetchResults: Option to ignore fetching results when updating variables
   */
  public setVariables(
    variables: TVariables,
    tryFetch: boolean = false,
    fetchResults = true,
  ): Promise<ApolloQueryResult<TData>> {
    // since setVariables restarts the subscription, we reset the tornDown status
    this.isTornDown = false;

    const newVariables = variables ? variables : this.variables;

    if (isEqual(newVariables, this.variables) && !tryFetch) {
      // If we have no observers, then we don't actually want to make a network
      // request. As soon as someone observes the query, the request will kick
      // off. For now, we just store any changes. (See #1077)
      if (this.observers.length === 0 || !fetchResults) {
        return new Promise(resolve => resolve());
      }
      return this.result();
    } else {
      this.variables = newVariables;
      this.options.variables = newVariables;

      // See comment above
      if (this.observers.length === 0) {
        return new Promise(resolve => resolve());
      }

      // Use the same options as before, but with new variables
      return this.queryManager
        .fetchQuery(this.queryId, {
          ...this.options,
          variables: this.variables,
        } as WatchQueryOptions)
        .then(result => result as ApolloQueryResult<TData>);
    }
  }

  public updateQuery(
    mapFn: (
      previousQueryResult: TData,
      options: UpdateQueryOptions<TVariables>,
    ) => TData,
  ): void {
    const {
      previousResult,
      variables,
      document,
    } = this.queryManager.getQueryWithPreviousResult(this.queryId);

    const newResult = tryFunctionOrLogError(() =>
      mapFn(previousResult, { variables: variables as TVariables }),
    );

    if (newResult) {
      this.queryManager.dataStore.markUpdateQueryResult(
        document,
        variables,
        newResult,
      );
      this.queryManager.broadcastQueries();
    }
  }

  public stopPolling() {
    this.queryManager.stopPollingQuery(this.queryId);
    this.options.pollInterval = undefined;
  }

  public startPolling(pollInterval: number) {
    assertNotCacheFirstOrOnly(this);
    this.options.pollInterval = pollInterval;
    this.queryManager.startPollingQuery(this.options, this.queryId);
  }

  private onSubscribe(observer: Observer<ApolloQueryResult<TData>>) {
    // Zen Observable has its own error function, in order to log correctly
    // we need to declare a custom error if nothing is passed
    if (
      (observer as any)._subscription &&
      (observer as any)._subscription._observer &&
      !(observer as any)._subscription._observer.error
    ) {
      (observer as any)._subscription._observer.error = (
        error: ApolloError,
      ) => {
        invariant.error('Unhandled error', error.message, error.stack);
      };
    }

    this.observers.push(observer);

    // Deliver initial result
    if (observer.next && this.lastResult) observer.next(this.lastResult);
    if (observer.error && this.lastError) observer.error(this.lastError);

    // setup the query if it hasn't been done before
    if (this.observers.length === 1) this.setUpQuery();

    return () => {
      this.observers = this.observers.filter(obs => obs !== observer);

      if (this.observers.length === 0) {
        this.tearDownQuery();
      }
    };
  }

  private setUpQuery() {
    if (this.shouldSubscribe) {
      this.queryManager.addObservableQuery<TData>(this.queryId, this);
    }

    if (!!this.options.pollInterval) {
      assertNotCacheFirstOrOnly(this);
      this.queryManager.startPollingQuery(this.options, this.queryId);
    }

    const observer: Observer<ApolloQueryResult<TData>> = {
      next: (result: ApolloQueryResult<TData>) => {
        this.lastResult = result;
        this.lastResultSnapshot = this.queryManager.assumeImmutableResults
          ? result : cloneDeep(result);
        this.observers.forEach(obs => obs.next && obs.next(result));
      },
      error: (error: ApolloError) => {
        this.lastError = error;
        this.observers.forEach(obs => obs.error && obs.error(error));
      },
    };

    this.queryManager.startQuery<TData>(
      this.queryId,
      this.options,
      this.queryManager.queryListenerForObserver(
        this.queryId,
        this.options,
        observer,
      ),
    );
  }

  private tearDownQuery() {
    this.isTornDown = true;
    this.queryManager.stopPollingQuery(this.queryId);

    // stop all active GraphQL subscriptions
    this.subscriptionHandles.forEach(sub => sub.unsubscribe());
    this.subscriptionHandles = [];

    this.queryManager.removeObservableQuery(this.queryId);

    this.queryManager.stopQuery(this.queryId);

    this.observers = [];
  }
}

function assertNotCacheFirstOrOnly<TData, TVariables>(
  obsQuery: ObservableQuery<TData, TVariables>,
) {
  const { fetchPolicy } = obsQuery.options;
  invariant(
    fetchPolicy !== 'cache-first' && fetchPolicy !== 'cache-only',
    'Queries that specify the cache-first and cache-only fetchPolicies cannot also be polling queries.',
  );
}
