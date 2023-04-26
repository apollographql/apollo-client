import { invariant } from '../utilities/globals';
import { DocumentNode } from 'graphql';
import { equal } from '@wry/equality';

import { NetworkStatus, isNetworkRequestInFlight } from './networkStatus';
import {
  Concast,
  cloneDeep,
  compact,
  getOperationDefinition,
  Observable,
  Observer,
  ObservableSubscription,
  iterateObserversSafely,
  isNonEmptyArray,
  fixObservableSubclass,
  getQueryDefinition,
} from '../utilities';
import { ApolloError } from '../errors';
import { QueryManager } from './QueryManager';
import {
  ApolloQueryResult,
  OperationVariables,
  TypedDocumentNode,
} from './types';
import {
  WatchQueryOptions,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  NextFetchPolicyContext,
} from './watchQueryOptions';
import { QueryInfo } from './QueryInfo';
import { MissingFieldError } from '../cache';
import { MissingTree } from '../cache/core/types/common';

const {
  assign,
  hasOwnProperty,
} = Object;

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

interface Last<TData, TVariables> {
  result: ApolloQueryResult<TData>;
  variables?: TVariables;
  error?: ApolloError;
}

export class ObservableQuery<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
> extends Observable<ApolloQueryResult<TData>> {
  public readonly options: WatchQueryOptions<TVariables, TData>;
  public readonly queryId: string;
  public readonly queryName?: string;

  public get query(): TypedDocumentNode<TData, TVariables> {
    // This transform is heavily cached, so it should not be expensive to
    // transform the same this.options.query document repeatedly.
    return this.queryManager.transform(this.options.query).document;
  }

  // Computed shorthand for this.options.variables, preserved for
  // backwards compatibility.
  public get variables(): TVariables | undefined {
    return this.options.variables;
  }

  private isTornDown: boolean;
  private queryManager: QueryManager<any>;
  private observers = new Set<Observer<ApolloQueryResult<TData>>>();
  private subscriptions = new Set<ObservableSubscription>();

  private last?: Last<TData, TVariables>;

  private queryInfo: QueryInfo;

  // When this.concast is defined, this.observer is the Observer currently
  // subscribed to that Concast.
  private concast?: Concast<ApolloQueryResult<TData>>;
  private observer?: Observer<ApolloQueryResult<TData>>;

  private pollingInfo?: {
    interval: number;
    timeout: ReturnType<typeof setTimeout>;
  };

  constructor({
    queryManager,
    queryInfo,
    options,
  }: {
    queryManager: QueryManager<any>;
    queryInfo: QueryInfo;
    options: WatchQueryOptions<TVariables, TData>;
  }) {
    super((observer: Observer<ApolloQueryResult<TData>>) => {
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

      // Deliver most recent error or result.
      const last = this.last;
      if (last && last.error) {
        observer.error && observer.error(last.error);
      } else if (last && last.result) {
        observer.next && observer.next(last.result);
      }

      // Initiate observation of this query if it hasn't been reported to
      // the QueryManager yet.
      if (first) {
        // Blindly catching here prevents unhandled promise rejections,
        // and is safe because the ObservableQuery handles this error with
        // this.observer.error, so we're not just swallowing the error by
        // ignoring it here.
        this.reobserve().catch(() => {});
      }

      return () => {
        if (this.observers.delete(observer) && !this.observers.size) {
          this.tearDownQuery();
        }
      };
    });

    // related classes
    this.queryInfo = queryInfo;
    this.queryManager = queryManager;

    // active state
    this.isTornDown = false;

    const {
      watchQuery: {
        fetchPolicy: defaultFetchPolicy = "cache-first",
      } = {},
    } = queryManager.defaultOptions;

    const {
      fetchPolicy = defaultFetchPolicy,
      initialFetchPolicy = (
        // Make sure we don't store "standby" as the initialFetchPolicy.
        fetchPolicy === "standby" ? defaultFetchPolicy : fetchPolicy
      ),
    } = options;

    this.options = {
      ...options,

      // Remember the initial options.fetchPolicy so we can revert back to this
      // policy when variables change. This information can also be specified
      // (or overridden) by providing options.initialFetchPolicy explicitly.
      initialFetchPolicy,

      // This ensures this.options.fetchPolicy always has a string value, in
      // case options.fetchPolicy was not provided.
      fetchPolicy,
    };

    this.queryId = queryInfo.queryId || queryManager.generateQueryId();

    const opDef = getOperationDefinition(this.query);
    this.queryName = opDef && opDef.name && opDef.name.value;
  }

  public result(): Promise<ApolloQueryResult<TData>> {
    return new Promise((resolve, reject) => {
      // TODO: this code doesn’t actually make sense insofar as the observer
      // will never exist in this.observers due how zen-observable wraps observables.
      // https://github.com/zenparsing/zen-observable/blob/master/src/Observable.js#L169
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

  public getCurrentResult(saveAsLastResult = true): ApolloQueryResult<TData> {
    // Use the last result as long as the variables match this.variables.
    const lastResult = this.getLastResult(true);

    const networkStatus =
      this.queryInfo.networkStatus ||
      (lastResult && lastResult.networkStatus) ||
      NetworkStatus.ready;

    const result = {
      ...lastResult,
      loading: isNetworkRequestInFlight(networkStatus),
      networkStatus,
    } as ApolloQueryResult<TData>;

    const { fetchPolicy = "cache-first" } = this.options;
    if (
      // These fetch policies should never deliver data from the cache, unless
      // redelivering a previously delivered result.
      fetchPolicy === 'network-only' ||
      fetchPolicy === 'no-cache' ||
      fetchPolicy === 'standby' ||
      // If this.options.query has @client(always: true) fields, we cannot
      // trust diff.result, since it was read from the cache without running
      // local resolvers (and it's too late to run resolvers now, since we must
      // return a result synchronously).
      this.queryManager.transform(this.options.query).hasForcedResolvers
    ) {
      // Fall through.
    } else {
      const diff = this.queryInfo.getDiff();

      if (diff.complete || this.options.returnPartialData) {
        result.data = diff.result;
      }

      if (equal(result.data, {})) {
        result.data = void 0 as any;
      }

      if (diff.complete) {
        // Similar to setting result.partial to false, but taking advantage of the
        // falsiness of missing fields.
        delete result.partial;

        // If the diff is complete, and we're using a FetchPolicy that
        // terminates after a complete cache read, we can assume the next result
        // we receive will have NetworkStatus.ready and !loading.
        if (
          diff.complete &&
          result.networkStatus === NetworkStatus.loading &&
          (fetchPolicy === 'cache-first' ||
          fetchPolicy === 'cache-only')
        ) {
          result.networkStatus = NetworkStatus.ready;
          result.loading = false;
        }
      } else {
        result.partial = true;
      }

      if (
        __DEV__ &&
        !diff.complete &&
        !this.options.partialRefetch &&
        !result.loading &&
        !result.data &&
        !result.error
      ) {
        logMissingFieldErrors(diff.missing);
      }
    }

    if (saveAsLastResult) {
      this.updateLastResult(result);
    }

    return result;
  }

  // Compares newResult to the snapshot we took of this.lastResult when it was
  // first received.
  public isDifferentFromLastResult(
    newResult: ApolloQueryResult<TData>,
    variables?: TVariables
  ) {
    return (
      !this.last ||
      !equal(this.last.result, newResult) ||
      (variables && !equal(this.last.variables, variables))
    );
  }

  private getLast<K extends keyof Last<TData, TVariables>>(
    key: K,
    variablesMustMatch?: boolean,
  ) {
    const last = this.last;
    if (
      last &&
      last[key] &&
      (!variablesMustMatch || equal(last.variables, this.variables))
    ) {
      return last[key];
    }
  }

  public getLastResult(variablesMustMatch?: boolean): ApolloQueryResult<TData> | undefined {
    return this.getLast("result", variablesMustMatch);
  }

  public getLastError(variablesMustMatch?: boolean): ApolloError | undefined {
    return this.getLast("error", variablesMustMatch);
  }

  public resetLastResults(): void {
    delete this.last;
    this.isTornDown = false;
  }

  public resetQueryStoreErrors() {
    this.queryManager.resetErrors(this.queryId);
  }

  /**
   * Update the variables of this observable query, and fetch the new results.
   * This method should be preferred over `setVariables` in most use cases.
   *
   * @param variables: The new set of variables. If there are missing variables,
   * the previous values of those variables will be used.
   */
  public refetch(variables?: Partial<TVariables>): Promise<ApolloQueryResult<TData>> {
    const reobserveOptions: Partial<WatchQueryOptions<TVariables, TData>> = {
      // Always disable polling for refetches.
      pollInterval: 0,
    };

    // Unless the provided fetchPolicy always consults the network
    // (no-cache, network-only, or cache-and-network), override it with
    // network-only to force the refetch for this fetchQuery call.
    const { fetchPolicy } = this.options;
    if (fetchPolicy === 'cache-and-network') {
      reobserveOptions.fetchPolicy = fetchPolicy;
    } else if (fetchPolicy === 'no-cache') {
      reobserveOptions.fetchPolicy = 'no-cache';
    } else {
      reobserveOptions.fetchPolicy = 'network-only';
    }

    if (__DEV__ && variables && hasOwnProperty.call(variables, "variables")) {
      const queryDef = getQueryDefinition(this.query);
      const vars = queryDef.variableDefinitions;
      if (!vars || !vars.some(v => v.variable.name.value === "variables")) {
        invariant.warn(`Called refetch(${
          JSON.stringify(variables)
        }) for query ${
          queryDef.name?.value || JSON.stringify(queryDef)
        }, which does not declare a $variables variable.
Did you mean to call refetch(variables) instead of refetch({ variables })?`);
      }
    }

    if (variables && !equal(this.options.variables, variables)) {
      // Update the existing options with new variables
      reobserveOptions.variables = this.options.variables = {
        ...this.options.variables,
        ...variables,
      } as TVariables;
    }

    this.queryInfo.resetLastWrite();
    return this.reobserve(reobserveOptions, NetworkStatus.refetch);
  }

  public fetchMore<
    TFetchData = TData,
    TFetchVars extends OperationVariables = TVariables,
  >(fetchMoreOptions: FetchMoreQueryOptions<TFetchVars, TFetchData> & {
    updateQuery?: (
      previousQueryResult: TData,
      options: {
        fetchMoreResult: TFetchData;
        variables: TFetchVars;
      },
    ) => TData;
  }): Promise<ApolloQueryResult<TFetchData>> {
    const combinedOptions = {
      ...(fetchMoreOptions.query ? fetchMoreOptions : {
        ...this.options,
        query: this.query,
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
    } as WatchQueryOptions<TFetchVars, TFetchData>;

    const qid = this.queryManager.generateQueryId();

    // Simulate a loading result for the original query with
    // result.networkStatus === NetworkStatus.fetchMore.
    const { queryInfo } = this;
    const originalNetworkStatus = queryInfo.networkStatus;
    queryInfo.networkStatus = NetworkStatus.fetchMore;
    if (combinedOptions.notifyOnNetworkStatusChange) {
      this.observe();
    }

    const updatedQuerySet = new Set<DocumentNode>();

    return this.queryManager.fetchQuery(
      qid,
      combinedOptions,
      NetworkStatus.fetchMore,
    ).then(fetchMoreResult => {
      this.queryManager.removeQuery(qid);

      if (queryInfo.networkStatus === NetworkStatus.fetchMore) {
        queryInfo.networkStatus = originalNetworkStatus;
      }

      // Performing this cache update inside a cache.batch transaction ensures
      // any affected cache.watch watchers are notified at most once about any
      // updates. Most watchers will be using the QueryInfo class, which
      // responds to notifications by calling reobserveCacheFirst to deliver
      // fetchMore cache results back to this ObservableQuery.
      this.queryManager.cache.batch({
        update: cache => {
          const { updateQuery } = fetchMoreOptions;
          if (updateQuery) {
            cache.updateQuery({
              query: this.query,
              variables: this.variables,
              returnPartialData: true,
              optimistic: false,
            }, previous => updateQuery(previous!, {
              fetchMoreResult: fetchMoreResult.data,
              variables: combinedOptions.variables as TFetchVars,
            }));

          } else {
            // If we're using a field policy instead of updateQuery, the only
            // thing we need to do is write the new data to the cache using
            // combinedOptions.variables (instead of this.variables, which is
            // what this.updateQuery uses, because it works by abusing the
            // original field value, keyed by the original variables).
            cache.writeQuery({
              query: combinedOptions.query,
              variables: combinedOptions.variables,
              data: fetchMoreResult.data,
            });
          }
        },

        onWatchUpdated: watch => {
          // Record the DocumentNode associated with any watched query whose
          // data were updated by the cache writes above.
          updatedQuerySet.add(watch.query);
        },
      });

      return fetchMoreResult;

    }).finally(() => {
      // In case the cache writes above did not generate a broadcast
      // notification (which would have been intercepted by onWatchUpdated),
      // likely because the written data were the same as what was already in
      // the cache, we still want fetchMore to deliver its final loading:false
      // result with the unchanged data.
      if (!updatedQuerySet.has(this.query)) {
        reobserveCacheFirst(this);
      }
    });
  }

  // XXX the subscription variables are separate from the query variables.
  // if you want to update subscription variables, right now you have to do that separately,
  // and you can only do it by stopping the subscription and then subscribing again with new variables.
  public subscribeToMore<
    TSubscriptionData = TData,
    TSubscriptionVariables extends OperationVariables = TVariables
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
        context: options.context,
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

  public setOptions(
    newOptions: Partial<WatchQueryOptions<TVariables, TData>>,
  ): Promise<ApolloQueryResult<TData>> {
    return this.reobserve(newOptions);
  }

  /**
   * Update the variables of this observable query, and fetch the new results
   * if they've changed. Most users should prefer `refetch` instead of
   * `setVariables` in order to to be properly notified of results even when
   * they come from the cache.
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
   */
  public setVariables(
    variables: TVariables,
  ): Promise<ApolloQueryResult<TData> | void> {
    if (equal(this.variables, variables)) {
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

    return this.reobserve({
      // Reset options.fetchPolicy to its original value.
      fetchPolicy: this.options.initialFetchPolicy,
      variables,
    }, NetworkStatus.setVariables);
  }

  public updateQuery<TVars extends OperationVariables = TVariables>(
    mapFn: (
      previousQueryResult: TData,
      options: Pick<WatchQueryOptions<TVars, TData>, "variables">,
    ) => TData,
  ): void {
    const { queryManager } = this;
    const { result } = queryManager.cache.diff<TData>({
      query: this.options.query,
      variables: this.variables,
      returnPartialData: true,
      optimistic: false,
    });

    const newResult = mapFn(result!, {
      variables: (this as any).variables,
    });

    if (newResult) {
      queryManager.cache.writeQuery({
        query: this.options.query,
        data: newResult,
        variables: this.variables,
      });

      queryManager.broadcastQueries();
    }
  }

  public startPolling(pollInterval: number) {
    this.options.pollInterval = pollInterval;
    this.updatePolling();
  }

  public stopPolling() {
    this.options.pollInterval = 0;
    this.updatePolling();
  }

  // Update options.fetchPolicy according to options.nextFetchPolicy.
  private applyNextFetchPolicy(
    reason: NextFetchPolicyContext<TData, TVariables>["reason"],
    // It's possible to use this method to apply options.nextFetchPolicy to
    // options.fetchPolicy even if options !== this.options, though that happens
    // most often when the options are temporary, used for only one request and
    // then thrown away, so nextFetchPolicy may not end up mattering.
    options: WatchQueryOptions<TVariables, TData>,
  ) {
    if (options.nextFetchPolicy) {
      const {
        fetchPolicy = "cache-first",
        initialFetchPolicy = fetchPolicy,
      } = options;

      if (fetchPolicy === "standby") {
        // Do nothing, leaving options.fetchPolicy unchanged.
      } else if (typeof options.nextFetchPolicy === "function") {
        // When someone chooses "cache-and-network" or "network-only" as their
        // initial FetchPolicy, they often do not want future cache updates to
        // trigger unconditional network requests, which is what repeatedly
        // applying the "cache-and-network" or "network-only" policies would
        // seem to imply. Instead, when the cache reports an update after the
        // initial network request, it may be desirable for subsequent network
        // requests to be triggered only if the cache result is incomplete. To
        // that end, the options.nextFetchPolicy option provides an easy way to
        // update options.fetchPolicy after the initial network request, without
        // having to call observableQuery.setOptions.
        options.fetchPolicy = options.nextFetchPolicy(fetchPolicy, {
          reason,
          options,
          observable: this,
          initialFetchPolicy,
        });
      } else if (reason === "variables-changed") {
        options.fetchPolicy = initialFetchPolicy;
      } else {
        options.fetchPolicy = options.nextFetchPolicy;
      }
    }

    return options.fetchPolicy;
  }

  private fetch(
    options: WatchQueryOptions<TVariables, TData>,
    newNetworkStatus?: NetworkStatus,
  ) {
    // TODO Make sure we update the networkStatus (and infer fetchVariables)
    // before actually committing to the fetch.
    this.queryManager.setObservableQuery(this);
    return this.queryManager['fetchConcastWithInfo'](
      this.queryId,
      options,
      newNetworkStatus,
    );
  }

  // Turns polling on or off based on this.options.pollInterval.
  private updatePolling() {
    // Avoid polling in SSR mode
    if (this.queryManager.ssrMode) {
      return;
    }

    const {
      pollingInfo,
      options: {
        pollInterval,
      },
    } = this;

    if (!pollInterval) {
      if (pollingInfo) {
        clearTimeout(pollingInfo.timeout);
        delete this.pollingInfo;
      }
      return;
    }

    if (pollingInfo &&
        pollingInfo.interval === pollInterval) {
      return;
    }

    invariant(
      pollInterval,
      'Attempted to start a polling query without a polling interval.',
    );

    const info = pollingInfo || (this.pollingInfo = {} as any);
    info.interval = pollInterval;

    const maybeFetch = () => {
      if (this.pollingInfo) {
        if (!isNetworkRequestInFlight(this.queryInfo.networkStatus)) {
          this.reobserve({
            // Most fetchPolicy options don't make sense to use in a polling context, as
            // users wouldn't want to be polling the cache directly. However, network-only and
            // no-cache are both useful for when the user wants to control whether or not the
            // polled results are written to the cache.
            fetchPolicy: this.options.initialFetchPolicy === 'no-cache' ? 'no-cache' : 'network-only',
          }, NetworkStatus.poll).then(poll, poll);
        } else {
          poll();
        }
      };
    };

    const poll = () => {
      const info = this.pollingInfo;
      if (info) {
        clearTimeout(info.timeout);
        info.timeout = setTimeout(maybeFetch, info.interval);
      }
    };

    poll();
  }

  private updateLastResult(
    newResult: ApolloQueryResult<TData>,
    variables = this.variables,
  ) {
    this.last = {
      ...this.last,
      result: this.queryManager.assumeImmutableResults
        ? newResult
        : cloneDeep(newResult),
      variables,
    };
    if (!isNonEmptyArray(newResult.errors)) {
      delete this.last.error;
    }
    return this.last;
  }

  public reobserveAsConcast(
    newOptions?: Partial<WatchQueryOptions<TVariables, TData>>,
    newNetworkStatus?: NetworkStatus,
  ): Concast<ApolloQueryResult<TData>> {
    this.isTornDown = false;

    const useDisposableConcast =
      // Refetching uses a disposable Concast to allow refetches using different
      // options/variables, without permanently altering the options of the
      // original ObservableQuery.
      newNetworkStatus === NetworkStatus.refetch ||
      // The fetchMore method does not actually call the reobserve method, but,
      // if it did, it would definitely use a disposable Concast.
      newNetworkStatus === NetworkStatus.fetchMore ||
      // Polling uses a disposable Concast so the polling options (which force
      // fetchPolicy to be "network-only" or "no-cache") won't override the original options.
      newNetworkStatus === NetworkStatus.poll;

    // Save the old variables, since Object.assign may modify them below.
    const oldVariables = this.options.variables;
    const oldFetchPolicy = this.options.fetchPolicy;

    const mergedOptions = compact(this.options, newOptions || {});
    const options = useDisposableConcast
      // Disposable Concast fetches receive a shallow copy of this.options
      // (merged with newOptions), leaving this.options unmodified.
      ? mergedOptions
      : assign(this.options, mergedOptions);

    if (!useDisposableConcast) {
      // We can skip calling updatePolling if we're not changing this.options.
      this.updatePolling();

      // Reset options.fetchPolicy to its original value when variables change,
      // unless a new fetchPolicy was provided by newOptions.
      if (
        newOptions &&
        newOptions.variables &&
        !equal(newOptions.variables, oldVariables) &&
        // Don't mess with the fetchPolicy if it's currently "standby".
        options.fetchPolicy !== "standby" &&
        // If we're changing the fetchPolicy anyway, don't try to change it here
        // using applyNextFetchPolicy. The explicit options.fetchPolicy wins.
        options.fetchPolicy === oldFetchPolicy
      ) {
        this.applyNextFetchPolicy("variables-changed", options);
        if (newNetworkStatus === void 0) {
          newNetworkStatus = NetworkStatus.setVariables;
        }
      }
    }

    const variables = options.variables && { ...options.variables };
    const { concast, fromLink } = this.fetch(options, newNetworkStatus);
    const observer: Observer<ApolloQueryResult<TData>> = {
      next: result => {
        this.reportResult(result, variables);
      },
      error: error => {
        this.reportError(error, variables);
      },
    };

    if (!useDisposableConcast && fromLink) {
      // We use the {add,remove}Observer methods directly to avoid wrapping
      // observer with an unnecessary SubscriptionObserver object.
      if (this.concast && this.observer) {
        this.concast.removeObserver(this.observer);
      }

      this.concast = concast;
      this.observer = observer;
    }

    concast.addObserver(observer);

    return concast;
  }

  public reobserve(
    newOptions?: Partial<WatchQueryOptions<TVariables, TData>>,
    newNetworkStatus?: NetworkStatus,
  ) {
    return this.reobserveAsConcast(newOptions, newNetworkStatus).promise;
  }

  // (Re)deliver the current result to this.observers without applying fetch
  // policies or making network requests.
  private observe() {
    this.reportResult(
      // Passing false is important so that this.getCurrentResult doesn't
      // save the fetchMore result as this.lastResult, causing it to be
      // ignored due to the this.isDifferentFromLastResult check in
      // this.reportResult.
      this.getCurrentResult(false),
      this.variables,
    );
  }

  private reportResult(
    result: ApolloQueryResult<TData>,
    variables: TVariables | undefined,
  ) {
    const lastError = this.getLastError();
    if (lastError || this.isDifferentFromLastResult(result, variables)) {
      if (lastError || !result.partial || this.options.returnPartialData) {
        this.updateLastResult(result, variables);
      }

      iterateObserversSafely(this.observers, 'next', result);
    }
  }

  private reportError(
    error: ApolloError,
    variables: TVariables | undefined,
  ) {
    // Since we don't get the current result on errors, only the error, we
    // must mirror the updates that occur in QueryStore.markQueryError here
    const errorResult = {
      ...this.getLastResult(),
      error,
      errors: error.graphQLErrors,
      networkStatus: NetworkStatus.error,
      loading: false,
    } as ApolloQueryResult<TData>;

    this.updateLastResult(errorResult, variables);

    iterateObserversSafely(this.observers, 'error', this.last!.error = error);
  }

  public hasObservers() {
    return this.observers.size > 0;
  }

  private tearDownQuery() {
    if (this.isTornDown) return;
    if (this.concast && this.observer) {
      this.concast.removeObserver(this.observer);
      delete this.concast;
      delete this.observer;
    }

    this.stopPolling();
    // stop all active GraphQL subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
    this.queryManager.stopQuery(this.queryId);
    this.observers.clear();
    this.isTornDown = true;
  }
}

// Necessary because the ObservableQuery constructor has a different
// signature than the Observable constructor.
fixObservableSubclass(ObservableQuery);

// Reobserve with fetchPolicy effectively set to "cache-first", triggering
// delivery of any new data from the cache, possibly falling back to the network
// if any cache data are missing. This allows _complete_ cache results to be
// delivered without also kicking off unnecessary network requests when
// this.options.fetchPolicy is "cache-and-network" or "network-only". When
// this.options.fetchPolicy is any other policy ("cache-first", "cache-only",
// "standby", or "no-cache"), we call this.reobserve() as usual.
export function reobserveCacheFirst<TData, TVars extends OperationVariables>(
  obsQuery: ObservableQuery<TData, TVars>,
) {
  const { fetchPolicy, nextFetchPolicy } = obsQuery.options;

  if (
    fetchPolicy === "cache-and-network" ||
    fetchPolicy === "network-only"
  ) {
    return obsQuery.reobserve({
      fetchPolicy: "cache-first",
      // Use a temporary nextFetchPolicy function that replaces itself with the
      // previous nextFetchPolicy value and returns the original fetchPolicy.
      nextFetchPolicy(this: WatchQueryOptions<TVars, TData>) {
        // Replace this nextFetchPolicy function in the options object with the
        // original this.options.nextFetchPolicy value.
        this.nextFetchPolicy = nextFetchPolicy;
        // If the original nextFetchPolicy value was a function, give it a
        // chance to decide what happens here.
        if (typeof nextFetchPolicy === "function") {
          return nextFetchPolicy.apply(this, arguments);
        }
        // Otherwise go back to the original this.options.fetchPolicy.
        return fetchPolicy!;
      },
    });
  }

  return obsQuery.reobserve();
}

function defaultSubscriptionObserverErrorCallback(error: ApolloError) {
  invariant.error('Unhandled error', error.message, error.stack);
}

export function logMissingFieldErrors(
  missing: MissingFieldError[] | MissingTree | undefined,
) {
  if (__DEV__ && missing) {
    invariant.debug(`Missing cache result fields: ${
      JSON.stringify(missing)
    }`, missing);
  }
}
