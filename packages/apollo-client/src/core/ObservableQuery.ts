import {
  isEqual,
  tryFunctionOrLogError,
  cloneDeep,
  getOperationDefinition,
  hasClientExports,
} from 'apollo-utilities';
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

import { invariant, InvariantError } from 'ts-invariant';

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
  public readonly queryId: string;
  public readonly queryName?: string;
  /**
   *
   * The current value of the variables for this query. Can change.
   */
  public variables: TVariables;

  private shouldSubscribe: boolean;
  private isTornDown: boolean;
  private queryManager: QueryManager<any>;
  private observers = new Set<Observer<ApolloQueryResult<TData>>>();
  private subscriptions = new Set<Subscription>();

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
      const { lastResult } = this;
      return {
        data: !this.lastError && lastResult && lastResult.data || void 0,
        error: this.lastError,
        loading: false,
        networkStatus: NetworkStatus.error,
      };
    }

    const { data, partial } = this.queryManager.getCurrentQueryResult(this);
    const queryStoreValue = this.queryManager.queryStore.get(this.queryId);
    let result: ApolloQueryResult<TData>;

    if (queryStoreValue) {
      const { networkStatus } = queryStoreValue;

      if (hasError(queryStoreValue, this.options.errorPolicy)) {
        return {
          data: void 0,
          loading: false,
          networkStatus,
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
      if (queryStoreValue.variables) {
        this.options.variables = {
          ...this.options.variables,
          ...(queryStoreValue.variables as TVariables),
        };
        this.variables = this.options.variables;
      }

      result = {
        data,
        loading: isNetworkRequestInFlight(networkStatus),
        networkStatus,
      } as ApolloQueryResult<TData>;

      if (queryStoreValue.graphQLErrors && this.options.errorPolicy === 'all') {
        result.errors = queryStoreValue.graphQLErrors;
      }
    } else {
      // We need to be careful about the loading state we show to the user, to try
      // and be vaguely in line with what the user would have seen from .subscribe()
      // but to still provide useful information synchronously when the query
      // will not end up hitting the server.
      // See more: https://github.com/apollostack/apollo-client/issues/707
      // Basically: is there a query in flight right now (modolo the next tick)?
      const { fetchPolicy } = this.options;
      const loading =
        fetchPolicy === 'network-only' ||
        (partial && fetchPolicy !== 'cache-only');

      result = {
        data,
        loading,
        networkStatus: loading ? NetworkStatus.loading : NetworkStatus.ready,
      } as ApolloQueryResult<TData>;
    }

    if (!partial) {
      this.lastResult = { ...result, stale: false };
      this.lastResultSnapshot = this.queryManager.assumeImmutableResults
        ? this.lastResult
        : cloneDeep(this.lastResult);
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
    let { fetchPolicy } = this.options;
    // early return if trying to read from cache during refetch
    if (fetchPolicy === 'cache-only') {
      return Promise.reject(new InvariantError(
        'cache-only fetchPolicy option should not be used together with query refetch.',
      ));
    }

    // Override fetchPolicy for this call only
    // only network-only and no-cache are safe to use
    if (fetchPolicy !== 'no-cache') {
      fetchPolicy = 'network-only';
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

    return this.queryManager.fetchQuery(
      this.queryId,
      { ...this.options, fetchPolicy },
      FetchType.refetch,
    ) as Promise<ApolloQueryResult<TData>>;
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

    const combinedOptions = {
      ...(fetchMoreOptions.query ? fetchMoreOptions : {
        ...this.options,
        ...fetchMoreOptions,
        variables: {
          ...this.variables,
          ...fetchMoreOptions.variables,
        },
      }),
      fetchPolicy: 'network-only',
    } as WatchQueryOptions;

    return this.queryManager.fetchQuery(
      this.queryManager.generateQueryId(),
      combinedOptions,
      FetchType.normal,
      this.queryId,
    ).then(fetchMoreResult => {
      this.updateQuery((previousResult: any) =>
        fetchMoreOptions.updateQuery(previousResult, {
          fetchMoreResult: fetchMoreResult.data as TData,
          variables: combinedOptions.variables as TVariables,
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
    opts: ModifiableWatchQueryOptions,
  ): Promise<ApolloQueryResult<TData> | void> {
    const { fetchPolicy: oldFetchPolicy } = this.options;
    this.options = {
      ...this.options,
      ...opts,
    } as WatchQueryOptions<TVariables>;

    if (opts.pollInterval) {
      this.startPolling(opts.pollInterval);
    } else if (opts.pollInterval === 0) {
      this.stopPolling();
    }

    const { fetchPolicy } = opts;

    return this.setVariables(
      this.options.variables as TVariables,
      // Try to fetch the query if fetchPolicy changed from either cache-only
      // or standby to something else, or changed to network-only.
      oldFetchPolicy !== fetchPolicy && (
        oldFetchPolicy === 'cache-only' ||
        oldFetchPolicy === 'standby' ||
        fetchPolicy === 'network-only'
      ),
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
  ): Promise<ApolloQueryResult<TData> | void> {
    // since setVariables restarts the subscription, we reset the tornDown status
    this.isTornDown = false;

    variables = variables || this.variables;

    if (!tryFetch && isEqual(variables, this.variables)) {
      // If we have no observers, then we don't actually want to make a network
      // request. As soon as someone observes the query, the request will kick
      // off. For now, we just store any changes. (See #1077)
      return this.observers.size && fetchResults
        ? this.result()
        : Promise.resolve();
    }

    this.variables = this.options.variables = variables;

    // See comment above
    if (!this.observers.size) {
      return Promise.resolve();
    }

    // Use the same options as before, but with new variables
    return this.queryManager.fetchQuery(
      this.queryId,
      this.options,
    ) as Promise<ApolloQueryResult<TData>>;
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
    const first = !this.observers.size;
    this.observers.add(observer);

    // Deliver initial result
    if (observer.next && this.lastResult) observer.next(this.lastResult);
    if (observer.error && this.lastError) observer.error(this.lastError);

    // setup the query if it hasn't been done before
    if (first) this.setUpQuery();

    return () => {
      if (this.observers.delete(observer) && !this.observers.size) {
        this.tearDownQuery();
      }
    };
  }

  private async updateExportVariables() {
    const { query, variables } = this.options;
    const hasExports = hasClientExports(query);
    this.variables = (hasExports
      ? await this.queryManager
          .getLocalState()
          .addExportedVariables(query, variables)
      : variables) as TVariables;
    this.options.variables = this.variables;
    return hasExports;
  }

  private isRefetchRequired(
    lastVariables: TVariables,
    currentResult: ApolloQueryResult<TData>,
    lastResult: ApolloQueryResult<TData>,
    hasExports: boolean,
  ) {
    const { fetchPolicy, query } = this.options;
    return (
      !currentResult.loading &&
      lastResult &&
      fetchPolicy !== 'cache-only' &&
      this.queryManager.getLocalState().serverQuery(query) &&
      hasExports &&
      !isEqual(lastVariables, this.variables)
    );
  }

  private setUpQuery() {
    if (this.shouldSubscribe) {
      this.queryManager.addObservableQuery<TData>(this.queryId, this);
    }

    if (this.options.pollInterval) {
      assertNotCacheFirstOrOnly(this);
      this.queryManager.startPollingQuery(this.options, this.queryId);
    }

    const observer: Observer<ApolloQueryResult<TData>> = {
      next: (result: ApolloQueryResult<TData>) => {
        const lastVariables = this.variables;
        const lastResult = this.lastResult;

        this.lastResult = result;
        this.lastResultSnapshot = this.queryManager.assumeImmutableResults
          ? result
          : cloneDeep(result);

        // Before calling `next` on each observer, we need to first see if
        // the query is using `@client @export` directives, and update
        // any variables that might have changed. If `@export` variables have
        // changed, and the query is calling against both local and remote
        // data, a refetch is needed to pull in new data, using the
        // updated `@export` variables.
        this.updateExportVariables().then(hasExports => {
          this.isRefetchRequired(lastVariables, result, lastResult, hasExports)
            ? this.refetch()
            : iterateObserversSafely(this.observers, 'next', result);
        });
      },
      error: (error: ApolloError) => {
        this.lastError = error;
        iterateObserversSafely(this.observers, 'error', error);
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
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();

    this.queryManager.removeObservableQuery(this.queryId);

    this.queryManager.stopQuery(this.queryId);

    this.observers.clear();
  }
}

function iterateObserversSafely<E, A>(
  observers: Set<Observer<E>>,
  method: keyof Observer<E>,
  argument?: A,
) {
  // In case observers is modified during iteration, we need to commit to the
  // original elements, which also provides an opportunity to filter them down
  // to just the observers with the given method.
  const observersWithMethod: Observer<E>[] = [];
  observers.forEach(obs => obs[method] && observersWithMethod.push(obs));
  observersWithMethod.forEach(obs => (obs as any)[method](argument));
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
