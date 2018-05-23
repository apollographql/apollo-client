import {
  isEqual,
  tryFunctionOrLogError,
  maybeDeepFreeze,
} from 'apollo-utilities';
import { GraphQLError } from 'graphql';
import { NetworkStatus, isNetworkRequestInFlight } from './networkStatus';
import { Observable, Observer, Subscription } from '../util/Observable';

import { QueryScheduler } from '../scheduler/scheduler';

import { ApolloError } from '../errors/ApolloError';

import { QueryManager } from './QueryManager';
import { ApolloQueryResult, FetchType } from './types';
import {
  ModifiableWatchQueryOptions,
  WatchQueryOptions,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  ErrorPolicy,
  UpdateQueryFn,
} from './watchQueryOptions';

import { QueryStoreValue } from '../data/queries';

export type ApolloCurrentResult<T> = {
  data: T | {};
  errors?: GraphQLError[];
  loading: boolean;
  networkStatus: NetworkStatus;
  error?: ApolloError;
  partial?: boolean;
};

export interface FetchMoreOptions {
  updateQuery: (
    previousQueryResult: { [key: string]: any },
    options: {
      fetchMoreResult?: { [key: string]: any };
      variables: { [key: string]: any };
    },
  ) => Object;
}

export interface UpdateQueryOptions {
  variables?: Object;
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

export class ObservableQuery<T> extends Observable<ApolloQueryResult<T>> {
  public options: WatchQueryOptions;
  public queryId: string;
  /**
   *
   * The current value of the variables for this query. Can change.
   */
  public variables: { [key: string]: any };

  private isCurrentlyPolling: boolean;
  private shouldSubscribe: boolean;
  private isTornDown: boolean;
  private scheduler: QueryScheduler<any>;
  private queryManager: QueryManager<any>;
  private observers: Observer<ApolloQueryResult<T>>[];
  private subscriptionHandles: Subscription[];

  private lastResult: ApolloQueryResult<T>;
  private lastError: ApolloError;

  constructor({
    scheduler,
    options,
    shouldSubscribe = true,
  }: {
    scheduler: QueryScheduler<any>;
    options: WatchQueryOptions;
    shouldSubscribe?: boolean;
  }) {
    super((observer: Observer<ApolloQueryResult<T>>) =>
      this.onSubscribe(observer),
    );

    // active state
    this.isCurrentlyPolling = false;
    this.isTornDown = false;

    // query information
    this.options = options;
    this.variables = options.variables || {};
    this.queryId = scheduler.queryManager.generateQueryId();
    this.shouldSubscribe = shouldSubscribe;

    // related classes
    this.scheduler = scheduler;
    this.queryManager = scheduler.queryManager;

    // interal data stores
    this.observers = [];
    this.subscriptionHandles = [];
  }

  public result(): Promise<ApolloQueryResult<T>> {
    const that = this;
    return new Promise((resolve, reject) => {
      let subscription: Subscription;
      const observer: Observer<ApolloQueryResult<T>> = {
        next(result) {
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
        error(error) {
          reject(error);
        },
      };
      subscription = that.subscribe(observer);
    });
  }

  /**
   * Return the result of the query from the local cache as well as some fetching status
   * `loading` and `networkStatus` allow to know if a request is in flight
   * `partial` lets you know if the result from the local cache is complete or partial
   * @return {result: Object, loading: boolean, networkStatus: number, partial: boolean}
   */
  public currentResult(): ApolloCurrentResult<T> {
    if (this.isTornDown) {
      return {
        data: this.lastError ? {} : this.lastResult ? this.lastResult.data : {},
        error: this.lastError,
        loading: false,
        networkStatus: NetworkStatus.error,
      };
    }

    const queryStoreValue = this.queryManager.queryStore.get(this.queryId);

    if (hasError(queryStoreValue, this.options.errorPolicy)) {
      return {
        data: {},
        loading: false,
        networkStatus: queryStoreValue.networkStatus,
        error: new ApolloError({
          graphQLErrors: queryStoreValue.graphQLErrors,
          networkError: queryStoreValue.networkError,
        }),
      };
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
    } as ApolloQueryResult<T>;

    if (
      queryStoreValue &&
      queryStoreValue.graphQLErrors &&
      this.options.errorPolicy === 'all'
    ) {
      result.errors = queryStoreValue.graphQLErrors;
    }

    if (!partial) {
      const stale = false;
      this.lastResult = { ...result, stale };
    }

    return { ...result, partial } as ApolloCurrentResult<T>;
  }

  // Returns the last result that observer.next was called with. This is not the same as
  // currentResult! If you're not sure which you need, then you probably need currentResult.
  public getLastResult(): ApolloQueryResult<T> {
    return this.lastResult;
  }

  public getLastError(): ApolloError {
    return this.lastError;
  }

  public resetLastResults(): void {
    delete this.lastResult;
    delete this.lastError;
    this.isTornDown = false;
  }

  public refetch(variables?: any): Promise<ApolloQueryResult<T>> {
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
      this.variables = {
        ...this.variables,
        ...variables,
      };
    }

    if (!isEqual(this.options.variables, this.variables)) {
      // Update the existing options with new variables
      this.options.variables = {
        ...this.options.variables,
        ...this.variables,
      };
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
      .then(result => maybeDeepFreeze(result));
  }

  public fetchMore(
    fetchMoreOptions: FetchMoreQueryOptions & FetchMoreOptions,
  ): Promise<ApolloQueryResult<T>> {
    // early return if no update Query
    if (!fetchMoreOptions.updateQuery) {
      throw new Error(
        'updateQuery option is required. This function defines how to update the query data with the new results.',
      );
    }

    return Promise.resolve()
      .then(() => {
        const qid = this.queryManager.generateQueryId();
        let combinedOptions: any;

        if (fetchMoreOptions.query) {
          // fetch a new query
          combinedOptions = fetchMoreOptions;
        } else {
          // fetch the same query with a possibly new variables
          combinedOptions = {
            ...this.options,
            ...fetchMoreOptions,
            variables: {
              ...this.variables,
              ...fetchMoreOptions.variables,
            },
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
        this.updateQuery(
          (previousResult: any, { variables }: { [key: string]: any }) =>
            fetchMoreOptions.updateQuery(previousResult, {
              fetchMoreResult: fetchMoreResult.data,
              variables,
            }),
        );

        return fetchMoreResult as ApolloQueryResult<T>;
      });
  }

  // XXX the subscription variables are separate from the query variables.
  // if you want to update subscription variables, right now you have to do that separately,
  // and you can only do it by stopping the subscription and then subscribing again with new variables.
  public subscribeToMore(options: SubscribeToMoreOptions): () => void {
    const subscription = this.queryManager
      .startGraphQLSubscription({
        query: options.document,
        variables: options.variables,
      })
      .subscribe({
        next: data => {
          if (options.updateQuery) {
            this.updateQuery((previous: Object, { variables }) =>
              (options.updateQuery as UpdateQueryFn)(previous, {
                subscriptionData: data,
                variables,
              }),
            );
          }
        },
        error: err => {
          if (options.onError) {
            options.onError(err);
            return;
          }
          console.error('Unhandled GraphQL subscription error', err);
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
  ): Promise<ApolloQueryResult<T>> {
    const oldOptions = this.options;
    this.options = {
      ...this.options,
      ...opts,
    } as WatchQueryOptions;

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
      this.options.variables,
      tryFetch,
      opts.fetchResults,
    );
  }

  /**
   * Update the variables of this observable query, and fetch the new results
   * if they've changed. If you want to force new results, use `refetch`.
   *
   * Note: if the variables have not changed, the promise will return the old
   * results immediately, and the `next` callback will *not* fire.
   *
   * Note: if the query is not active (there are no subscribers), the promise
   * will return null immediately.
   *
   * @param variables: The new set of variables. If there are missing variables,
   * the previous values of those variables will be used.
   *
   * @param tryFetch: Try and fetch new results even if the variables haven't
   * changed (we may still just hit the store, but if there's nothing in there
   * this will refetch)
   *
   * @param fetchResults: Option to ignore fetching results when updating variables
   *
   */
  public setVariables(
    variables: any,
    tryFetch: boolean = false,
    fetchResults = true,
  ): Promise<ApolloQueryResult<T>> {
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
        .then(result => maybeDeepFreeze(result));
    }
  }

  public updateQuery(
    mapFn: (previousQueryResult: any, options: UpdateQueryOptions) => any,
  ): void {
    const {
      previousResult,
      variables,
      document,
    } = this.queryManager.getQueryWithPreviousResult(this.queryId);

    const newResult = tryFunctionOrLogError(() =>
      mapFn(previousResult, { variables }),
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
    if (this.isCurrentlyPolling) {
      this.scheduler.stopPollingQuery(this.queryId);
      this.options.pollInterval = undefined;
      this.isCurrentlyPolling = false;
    }
  }

  public startPolling(pollInterval: number) {
    if (
      this.options.fetchPolicy === 'cache-first' ||
      this.options.fetchPolicy === 'cache-only'
    ) {
      throw new Error(
        'Queries that specify the cache-first and cache-only fetchPolicies cannot also be polling queries.',
      );
    }

    if (this.isCurrentlyPolling) {
      this.scheduler.stopPollingQuery(this.queryId);
      this.isCurrentlyPolling = false;
    }
    this.options.pollInterval = pollInterval;
    this.isCurrentlyPolling = true;
    this.scheduler.startPollingQuery(this.options, this.queryId);
  }

  private onSubscribe(observer: Observer<ApolloQueryResult<T>>) {
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
        console.error('Unhandled error', error.message, error.stack);
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
      this.queryManager.addObservableQuery<T>(this.queryId, this);
    }

    if (!!this.options.pollInterval) {
      if (
        this.options.fetchPolicy === 'cache-first' ||
        this.options.fetchPolicy === 'cache-only'
      ) {
        throw new Error(
          'Queries that specify the cache-first and cache-only fetchPolicies cannot also be polling queries.',
        );
      }

      this.isCurrentlyPolling = true;
      this.scheduler.startPollingQuery<T>(this.options, this.queryId);
    }

    const observer: Observer<ApolloQueryResult<T>> = {
      next: (result: ApolloQueryResult<T>) => {
        this.lastResult = result;
        this.observers.forEach(obs => obs.next && obs.next(result));
      },
      error: (error: ApolloError) => {
        this.lastError = error;
        this.observers.forEach(obs => obs.error && obs.error(error));
      },
    };

    this.queryManager.startQuery<T>(
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

    if (this.isCurrentlyPolling) {
      this.scheduler.stopPollingQuery(this.queryId);
      this.isCurrentlyPolling = false;
    }

    // stop all active GraphQL subscriptions
    this.subscriptionHandles.forEach(sub => sub.unsubscribe());
    this.subscriptionHandles = [];

    this.queryManager.removeObservableQuery(this.queryId);

    this.queryManager.stopQuery(this.queryId);

    this.observers = [];
  }
}
