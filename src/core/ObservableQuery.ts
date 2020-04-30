import { invariant, InvariantError } from 'ts-invariant';
import { equal } from '@wry/equality';

import { tryFunctionOrLogError } from '../utilities/common/errorHandling';
import { cloneDeep } from '../utilities/common/cloneDeep';
import { getOperationDefinition } from '../utilities/graphql/getFromAST';
import { NetworkStatus, isNetworkRequestInFlight } from './networkStatus';
import {
  Observable,
  Observer,
  ObservableSubscription
} from '../utilities/observables/Observable';
import { iterateObserversSafely } from '../utilities/observables/observables';
import { ApolloError } from '../errors/ApolloError';
import { QueryManager } from './QueryManager';
import { ApolloQueryResult, OperationVariables } from './types';
import {
  WatchQueryOptions,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  ErrorPolicy,
} from './watchQueryOptions';
import { QueryStoreValue } from './QueryInfo';
import { isNonEmptyArray } from '../utilities/common/arrays';
import { toPromise } from '../utilities/observables/observables';

export type ApolloCurrentQueryResult<T> = ApolloQueryResult<T> & {
  error?: ApolloError;
  partial?: boolean;
};

export interface FetchMoreOptions<
  TData = any,
  TVariables = OperationVariables
> {
  updateQuery?: (
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
) => storeValue && (
  storeValue.networkError ||
  (policy === 'none' && isNonEmptyArray(storeValue.graphQLErrors))
);

export class ObservableQuery<
  TData = any,
  TVariables = OperationVariables
> extends Observable<ApolloQueryResult<TData>> {
  public options: WatchQueryOptions<TVariables>;
  public readonly queryId: string;
  public readonly queryName?: string;
  public readonly watching: boolean;

  // Computed shorthand for this.options.variables, preserved for
  // backwards compatibility.
  public get variables(): TVariables | undefined {
    return this.options.variables;
  }

  private isTornDown: boolean;
  private queryManager: QueryManager<any>;
  private observers = new Set<Observer<ApolloQueryResult<TData>>>();
  private subscriptions = new Set<ObservableSubscription>();

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
    this.queryId = queryManager.generateQueryId();
    this.watching = shouldSubscribe;

    const opDef = getOperationDefinition(options.query);
    this.queryName = opDef && opDef.name && opDef.name.value;

    // related classes
    this.queryManager = queryManager;
  }

  public result(): Promise<ApolloQueryResult<TData>> {
    return new Promise((resolve, reject) => {
      const observer: Observer<ApolloQueryResult<TData>> = {
        next: (result: ApolloQueryResult<TData>) => {
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
          this.observers.delete(observer);
          if (!this.observers.size) {
            this.queryManager.removeQuery(this.queryId);
          }

          setTimeout(() => {
            subscription.unsubscribe();
          }, 0);
        },
        error: reject,
      };
      const subscription = this.subscribe(observer);
    });
  }

  public getCurrentResult(): ApolloCurrentQueryResult<TData> {
    const {
      lastResult,
      lastError,
      options: { fetchPolicy },
    } = this;

    const isNetworkFetchPolicy =
      fetchPolicy === 'network-only' ||
      fetchPolicy === 'no-cache';

    const networkStatus =
      lastError ? NetworkStatus.error :
      lastResult ? lastResult.networkStatus :
      isNetworkFetchPolicy ? NetworkStatus.loading :
      NetworkStatus.ready;

    const result: ApolloCurrentQueryResult<TData> = {
      data: !lastError && lastResult && lastResult.data || void 0,
      error: lastError,
      loading: isNetworkRequestInFlight(networkStatus),
      networkStatus,
    };

    if (this.isTornDown) {
      return result;
    }

    const { data, partial } = this.queryManager.getCurrentQueryResult(this);
    Object.assign(result, { data, partial });

    const queryStoreValue = this.queryManager.getQueryStoreValue(this.queryId);
    if (queryStoreValue) {
      const { networkStatus } = queryStoreValue;

      if (hasError(queryStoreValue, this.options.errorPolicy)) {
        return Object.assign(result, {
          data: void 0,
          networkStatus,
          error: new ApolloError({
            graphQLErrors: queryStoreValue.graphQLErrors,
            networkError: queryStoreValue.networkError,
          }),
        });
      }

      // Variables might have been added dynamically at query time, when
      // using `@client @export(as: "varname")` for example. When this happens,
      // the variables have been updated in the query store, but not updated on
      // the original `ObservableQuery`. We'll update the observable query
      // variables here to match, so retrieving from the cache doesn't fail.
      if (queryStoreValue.variables) {
        this.options.variables = {
          ...this.options.variables,
          ...(queryStoreValue.variables as TVariables),
        };
      }

      Object.assign(result, {
        loading: isNetworkRequestInFlight(networkStatus),
        networkStatus,
      });

      if (queryStoreValue.graphQLErrors && this.options.errorPolicy === 'all') {
        result.errors = queryStoreValue.graphQLErrors;
      }
    }

    if (!partial) {
      this.updateLastResult(result);
    }

    return result;
  }

  // Compares newResult to the snapshot we took of this.lastResult when it was
  // first received.
  public isDifferentFromLastResult(newResult: ApolloQueryResult<TData>) {
    return !equal(this.lastResultSnapshot, newResult);
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

  public resetQueryStoreErrors() {
    const queryStore = this.queryManager.getQueryStoreValue(this.queryId);
    if (queryStore) {
      queryStore.networkError = undefined;
      queryStore.graphQLErrors = [];
    }
  }

  /**
   * Update the variables of this observable query, and fetch the new results.
   * This method should be preferred over `setVariables` in most use cases.
   *
   * @param variables: The new set of variables. If there are missing variables,
   * the previous values of those variables will be used.
   */
  public refetch(variables?: TVariables): Promise<ApolloQueryResult<TData>> {
    let { fetchPolicy } = this.options;
    // early return if trying to read from cache during refetch
    if (fetchPolicy === 'cache-only') {
      return Promise.reject(new InvariantError(
        'cache-only fetchPolicy option should not be used together with query refetch.',
      ));
    }

    // Unless the provided fetchPolicy always consults the network
    // (no-cache, network-only, or cache-and-network), override it with
    // network-only to force the refetch for this fetchQuery call.
    if (fetchPolicy !== 'no-cache' &&
        fetchPolicy !== 'cache-and-network') {
      fetchPolicy = 'network-only';
    }

    if (variables && !equal(this.options.variables, variables)) {
      // Update the existing options with new variables
      this.options.variables = {
        ...this.options.variables,
        ...variables,
      };
    }

    return this.reobserve({
      fetchPolicy,
      variables,
    });
  }

  public fetchMore<K extends keyof TVariables>(
    fetchMoreOptions: FetchMoreQueryOptions<TVariables, K> &
      FetchMoreOptions<TData, TVariables>,
  ): Promise<ApolloQueryResult<TData>> {
    const combinedOptions = {
      ...(fetchMoreOptions.query ? fetchMoreOptions : {
        ...this.options,
        ...fetchMoreOptions,
        variables: {
          ...this.options.variables,
          ...fetchMoreOptions.variables,
        },
      }),
      // The fetchMore request goes immediately to the network and does
      // not automatically write its result to the cache (hence no-cache
      // instead of network-only), because we allow the caller of
      // fetchMore to provide an updateQuery callback that determines how
      // the data gets written to the cache.
      fetchPolicy: "no-cache",
    } as WatchQueryOptions;

    return this.queryManager.fetchQuery(
      this.queryId,
      combinedOptions,
      NetworkStatus.fetchMore,
    ).then(fetchMoreResult => {
      this.updateQuery((previousResult: any) => {
        const data = fetchMoreResult.data as TData;
        const { updateQuery } = fetchMoreOptions;
        return updateQuery ? updateQuery(previousResult, {
          fetchMoreResult: data,
          variables: combinedOptions.variables as TVariables,
        }) : data;
      });
      return fetchMoreResult as ApolloQueryResult<TData>;
    });
  }

  // XXX the subscription variables are separate from the query variables.
  // if you want to update subscription variables, right now you have to do that separately,
  // and you can only do it by stopping the subscription and then subscribing again with new variables.
  public subscribeToMore<
    TSubscriptionData = TData,
    TSubscriptionVariables = TVariables
  >(
    options: SubscribeToMoreOptions<
      TData,
      TSubscriptionVariables,
      TSubscriptionData
    >,
  ) {
    const subscription = this.queryManager
      .startGraphQLSubscription({
        query: options.document,
        variables: options.variables,
      })
      .subscribe({
        next: (subscriptionData: { data: TSubscriptionData }) => {
          const { updateQuery } = options;
          if (updateQuery) {
            this.updateQuery<TSubscriptionVariables>(
              (previous, { variables }) =>
                updateQuery(previous, {
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

    this.subscriptions.add(subscription);

    return () => {
      if (this.subscriptions.delete(subscription)) {
        subscription.unsubscribe();
      }
    };
  }

  // Note: if the query is not active (there are no subscribers), the promise
  // will return null immediately.
  public setOptions(
    opts: WatchQueryOptions,
  ): Promise<ApolloQueryResult<TData> | void> {
    const {
      fetchPolicy: oldFetchPolicy,
      variables: oldVariables,
    } = this.options;

    this.options = {
      ...this.options,
      ...opts,
    } as WatchQueryOptions<TVariables>;

    if (opts.pollInterval) {
      this.startPolling(opts.pollInterval);
    } else if (opts.pollInterval === 0) {
      this.stopPolling();
    }

    // Try to fetch the query if fetchPolicy changed from either cache-only
    // or standby to something else, or changed to network-only.
    const fetchPolicyChanged = oldFetchPolicy !== opts.fetchPolicy && (
      oldFetchPolicy === 'cache-only' ||
      oldFetchPolicy === 'standby' ||
      opts.fetchPolicy === 'network-only'
    );

    return this.setVariables(
      this.options.variables as TVariables,
      fetchPolicyChanged || !equal(this.variables, oldVariables),
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
   */
  public setVariables(
    variables: TVariables,
    tryFetch = !equal(this.variables, variables),
  ): Promise<ApolloQueryResult<TData> | void> {
    // since setVariables restarts the subscription, we reset the tornDown status
    this.isTornDown = false;

    if (!tryFetch) {
      // If we have no observers, then we don't actually want to make a network
      // request. As soon as someone observes the query, the request will kick
      // off. For now, we just store any changes. (See #1077)
      return this.observers.size
        ? this.result()
        : Promise.resolve();
    }

    this.options.variables = variables;

    // See comment above
    if (!this.observers.size) {
      return Promise.resolve();
    }

    return this.reobserve({ variables });
  }

  public updateQuery<TVars = TVariables>(
    mapFn: (
      previousQueryResult: TData,
      options: UpdateQueryOptions<TVars>,
    ) => TData,
  ): void {
    const { queryManager } = this;
    const {
      previousResult,
      variables,
      document,
    } = queryManager.getQueryWithPreviousResult<TData, TVars>(
      this.queryId,
    );

    const newResult = tryFunctionOrLogError(() =>
      mapFn(previousResult, { variables }),
    );

    if (newResult) {
      queryManager.cache.writeQuery({
        query: document,
        data: newResult,
        variables,
      });

      queryManager.broadcastQueries();
    }
  }

  public stopPolling() {
    this.queryManager.stopPollingQuery(this.queryId);
    this.options.pollInterval = undefined;
  }

  public startPolling(pollInterval: number) {
    this.options.pollInterval = pollInterval;
    this.queryManager.startPollingQuery(this.options, this.queryId);
  }

  private updateLastResult(newResult: ApolloQueryResult<TData>) {
    const previousResult = this.lastResult;
    this.lastResult = newResult;
    this.lastResultSnapshot = this.queryManager.assumeImmutableResults
      ? newResult
      : cloneDeep(newResult);
    if (!isNonEmptyArray(newResult.errors)) {
      delete this.lastError;
    }
    return previousResult;
  }

  private onSubscribe(observer: Observer<ApolloQueryResult<TData>>) {
    // Subscribing using this.observer will create an infinite notificaion
    // loop, but the intent of broadcasting results to all the other
    // this.observers can be satisfied without doing anything, which is
    // why we do not bother throwing an error here.
    if (observer === this.observer) {
      return () => {};
    }

    // Zen Observable has its own error function, so in order to log correctly
    // we need to provide a custom error callback.
    try {
      var subObserver = (observer as any)._subscription._observer;
      if (subObserver && !subObserver.error) {
        subObserver.error = defaultSubscriptionObserverErrorCallback;
      }
    } catch {}

    const first = !this.observers.size;
    this.observers.add(observer);

    // Deliver initial result
    if (observer.next && this.lastResult) observer.next(this.lastResult);
    if (observer.error && this.lastError) observer.error(this.lastError);

    // Initiate observation of this query if it hasn't been reported to
    // the QueryManager yet.
    if (first) {
      this.reobserve();
    }

    return () => {
      if (this.observers.delete(observer) && !this.observers.size) {
        this.tearDownQuery();
      }
    };
  }

  private reobserver?: (
    options?: Partial<WatchQueryOptions>,
  ) => Observable<ApolloQueryResult<TData>>;

  private reObsSub?: ObservableSubscription;

  public reobserve(options?: Partial<WatchQueryOptions>) {
    if (!this.reobserver) {
      this.reobserver = this.queryManager.observeQuery(this);
    }

    const observable = this.reobserver(options);
    const promise = toPromise(observable);

    if (this.reObsSub) this.reObsSub.unsubscribe();
    this.reObsSub = observable.subscribe(this.observer);

    return promise;
  }

  private observer: Observer<ApolloQueryResult<TData>> = {
    next: result => {
      if (this.lastError || this.isDifferentFromLastResult(result)) {
        const { queryManager } = this;
        const { query, variables, fetchPolicy } = this.options;
        const { hasClientExports } = queryManager.transform(query);
        const previousResult = this.updateLastResult(result);

        // Before calling `next` on each observer, we need to first see if
        // the query is using `@client @export` directives, and update
        // any variables that might have changed. If `@export` variables have
        // changed, `setVariables` is used to query the cache first, followed
        // by the network if needed.
        if (hasClientExports) {
          queryManager.getLocalState().addExportedVariables(
            query,
            variables,
          ).then((variables: TVariables) => {
            const previousVariables = this.variables;
            if (
              !result.loading &&
              previousResult &&
              fetchPolicy !== 'cache-only' &&
              !equal(previousVariables, variables)
            ) {
              this.setVariables(variables).then(updatedResult => {
                iterateObserversSafely(this.observers, 'next', updatedResult);
              });
            } else {
              this.options.variables = variables;
              iterateObserversSafely(this.observers, 'next', result);
            }
          });
        } else {
          iterateObserversSafely(this.observers, 'next', result);
        }
      }
    },

    error: (error: ApolloError) => {
      // Since we don't get the current result on errors, only the error, we
      // must mirror the updates that occur in QueryStore.markQueryError here
      this.updateLastResult({
        ...this.lastResult,
        errors: error.graphQLErrors,
        networkStatus: NetworkStatus.error,
        loading: false,
      });

      iterateObserversSafely(this.observers, 'error', this.lastError = error);
    },
  };

  private tearDownQuery() {
    const { queryManager } = this;

    if (this.reObsSub) {
      this.reObsSub.unsubscribe();
      delete this.reObsSub;
    }

    this.isTornDown = true;
    queryManager.stopPollingQuery(this.queryId);

    // stop all active GraphQL subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();

    queryManager.stopQuery(this.queryId);

    this.observers.clear();
  }
}

function defaultSubscriptionObserverErrorCallback(error: ApolloError) {
  invariant.error('Unhandled error', error.message, error.stack);
}
