import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";
import { Slot } from "optimism";
import type {
  InteropObservable,
  Observer,
  Subscribable,
  Subscription,
} from "rxjs";
import type { Observable } from "rxjs";
import { BehaviorSubject, filter, lastValueFrom, tap } from "rxjs";

import type { MissingFieldError } from "@apollo/client/cache";
import type { MissingTree } from "@apollo/client/cache";
import type { MaybeMasked, Unmasked } from "@apollo/client/masking";
import {
  cloneDeep,
  compact,
  getOperationDefinition,
  getQueryDefinition,
  preventUnhandledRejection,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { toQueryResult } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { equalByQuery } from "./equalByQuery.js";
import { isNetworkRequestInFlight, NetworkStatus } from "./networkStatus.js";
import type { QueryInfo } from "./QueryInfo.js";
import type { QueryManager } from "./QueryManager.js";
import type {
  ApolloQueryResult,
  ErrorLike,
  OperationVariables,
  QueryResult,
  TypedDocumentNode,
} from "./types.js";
import type {
  FetchMoreQueryOptions,
  NextFetchPolicyContext,
  SubscribeToMoreOptions,
  UpdateQueryMapFn,
  UpdateQueryOptions,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "./watchQueryOptions.js";

const { assign, hasOwnProperty } = Object;

export interface FetchMoreOptions<
  TData = unknown,
  TVariables = OperationVariables,
> {
  updateQuery?: (
    previousQueryResult: TData,
    options: {
      fetchMoreResult?: TData;
      variables?: TVariables;
    }
  ) => TData;
}

interface Last<TData, TVariables> {
  result: ApolloQueryResult<TData>;
  variables?: TVariables;
  error?: ErrorLike;
}

const newNetworkStatusSymbol: any = Symbol();
const uninitialized = {} as ApolloQueryResult<any>;

export class ObservableQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >
  implements
    Subscribable<ApolloQueryResult<MaybeMasked<TData>>>,
    InteropObservable<ApolloQueryResult<MaybeMasked<TData>>>
{
  /**
   * @internal
   * A slot used by the `useQuery` hook to indicate that `client.watchQuery`
   * should not register the query immediately, but instead wait for the query to
   * be started registered with the `QueryManager` when `useSyncExternalStore`
   * actively subscribes to it.
   */
  private static inactiveOnCreation = new Slot<boolean>();

  public readonly options: WatchQueryOptions<TVariables, TData>;
  public readonly queryId: string;
  public readonly queryName?: string;

  // The `query` computed property will always reflect the document transformed
  // by the last run query. `this.options.query` will always reflect the raw
  // untransformed query to ensure document transforms with runtime conditionals
  // are run on the original document.
  public get query(): TypedDocumentNode<TData, TVariables> {
    return this.lastQuery || this.options.query;
  }

  // Computed shorthand for this.options.variables, preserved for
  // backwards compatibility.
  /**
   * An object containing the variables that were provided for the query.
   */
  public get variables(): TVariables | undefined {
    return this.options.variables;
  }

  private subject: BehaviorSubject<ApolloQueryResult<MaybeMasked<TData>>>;
  private readonly observable: Observable<
    ApolloQueryResult<MaybeMasked<TData>>
  >;

  private isTornDown: boolean;
  private queryManager: QueryManager;
  private subscriptions = new Set<Subscription>();

  private waitForOwnResult: boolean;
  private last?: Last<TData, TVariables>;
  private lastQuery?: DocumentNode;

  private queryInfo: QueryInfo;

  private linkSubscription?: Subscription;
  private linkObservable?: Observable<ApolloQueryResult<TData>>;

  private pollingInfo?: {
    interval: number;
    timeout: ReturnType<typeof setTimeout>;
  };

  private networkStatus: NetworkStatus;

  constructor({
    queryManager,
    queryInfo,
    options,
  }: {
    queryManager: QueryManager;
    queryInfo: QueryInfo;
    options: WatchQueryOptions<TVariables, TData>;
  }) {
    this.networkStatus = NetworkStatus.loading;

    let startedInactive = ObservableQuery.inactiveOnCreation.getValue();
    this.subject = new BehaviorSubject(uninitialized);
    this.observable = this.subject.pipe(
      tap({
        subscribe: () => {
          if (startedInactive) {
            queryManager["queries"].set(this.queryId, queryInfo);
            startedInactive = false;
          }
          if (!this.subject.observed) {
            if (this.subject.value === uninitialized) {
              // Emitting a value in the `subscribe` callback of `tap` gives
              // the subject a chance to save this initial result without
              // emitting the placeholder value since this callback is executed
              // before `tap` subscribes to the source observable (the subject).
              // `reobserve` also has the chance to update this value if it
              // synchronously emits one (usually due to reporting a cache
              // value).
              //
              // We don't initialize the `BehaviorSubject` with
              // `getInitialResult` because its possible the cache might have
              // updated between when the `ObservableQuery` was instantiated and
              // when it is subscribed to. Updating the value here ensures we
              // report the most up-to-date result from the cache.
              this.subject.next(this.getInitialResult());
            }

            this.reobserve();

            // TODO: See if we can rework updatePolling to better handle this.
            // reobserve calls updatePolling but this `subscribe` callback is
            // called before the subject is subscribed to so `updatePolling`
            // can't accurately detect if there is an active subscription.
            // Calling it again here ensures that it can detect if it can poll
            setTimeout(() => this.updatePolling());
          }
        },
        unsubscribe: () => {
          if (!this.subject.observed) {
            this.tearDownQuery();
          }
        },
      }),
      filter((result) => {
        return (
          this.options.fetchPolicy !== "standby" &&
          (this.options.notifyOnNetworkStatusChange ||
            !result.loading ||
            // data could be defined for cache-and-network fetch policies
            // when emitting the cache result while loading the network result
            !!result.data)
        );
      })
    );

    this["@@observable"] = () => this;
    if (Symbol.observable) {
      this[Symbol.observable] = () => this;
    }
    this.pipe = this.observable.pipe.bind(this.observable);
    this.subscribe = this.observable.subscribe.bind(this.observable);

    // related classes
    this.queryInfo = queryInfo;
    this.queryManager = queryManager;

    // active state
    this.waitForOwnResult = skipCacheDataFor(options.fetchPolicy);
    this.isTornDown = false;

    this.subscribe = this.subscribe.bind(this);
    this.subscribeToMore = this.subscribeToMore.bind(this);
    this.maskResult = this.maskResult.bind(this);

    const {
      watchQuery: { fetchPolicy: defaultFetchPolicy = "cache-first" } = {},
    } = queryManager.defaultOptions;

    const {
      fetchPolicy = defaultFetchPolicy,
      // Make sure we don't store "standby" as the initialFetchPolicy.
      initialFetchPolicy = fetchPolicy === "standby" ? defaultFetchPolicy : (
        fetchPolicy
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

  // We can't use Observable['subscribe'] here as the type as it conflicts with
  // the ability to infer T from Subscribable<T>. This limits the surface area
  // to the non-deprecated signature which works properly with type inference.
  public subscribe: (
    observer:
      | Partial<Observer<ApolloQueryResult<MaybeMasked<TData>>>>
      | ((value: ApolloQueryResult<MaybeMasked<TData>>) => void)
  ) => Subscription;

  public pipe: Observable<ApolloQueryResult<MaybeMasked<TData>>>["pipe"];

  public [Symbol.observable]!: () => Subscribable<
    ApolloQueryResult<MaybeMasked<TData>>
  >;
  public ["@@observable"]: () => Subscribable<
    ApolloQueryResult<MaybeMasked<TData>>
  >;

  /** @internal */
  public resetDiff() {
    this.queryInfo.resetDiff();
  }

  private getInitialResult(): ApolloQueryResult<MaybeMasked<TData>> {
    const fetchPolicy =
      this.queryManager.prioritizeCacheValues ?
        "cache-first"
      : this.options.fetchPolicy;
    const defaultResult = {
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    };

    const cacheResult = () => {
      const diff = this.queryInfo.getDiff();

      return this.maskResult({
        data:
          // TODO: queryInfo.getDiff should handle this since cache.diff returns a
          // null when returnPartialData is false
          this.options.returnPartialData || diff.complete ?
            (diff.result as TData) ?? undefined
          : undefined,
        loading: !diff.complete,
        networkStatus:
          diff.complete ? NetworkStatus.ready : NetworkStatus.loading,
        partial: !diff.complete,
      });
    };

    switch (fetchPolicy) {
      case "cache-only":
      case "cache-first":
        return cacheResult();
      case "cache-and-network":
        return {
          ...cacheResult(),
          loading: true,
          networkStatus: NetworkStatus.loading,
        };
      case "standby":
        return {
          ...defaultResult,
          loading: false,
          networkStatus: NetworkStatus.ready,
        };

      default:
        return defaultResult;
    }
  }

  private getCurrentFullResult(
    saveAsLastResult = true
  ): ApolloQueryResult<TData> {
    // Use the last result as long as the variables match this.variables.
    const lastResult = this.getLastResult(true);
    const networkStatus = this.networkStatus;

    const result: ApolloQueryResult<TData> = {
      data: undefined,
      partial: true,
      ...lastResult,
      loading: isNetworkRequestInFlight(networkStatus),
      networkStatus,
    };

    let { fetchPolicy = "cache-first" } = this.options;
    const { prioritizeCacheValues } = this.queryManager;
    if (prioritizeCacheValues) {
      fetchPolicy = "cache-first";
    }
    if (
      // These fetch policies should never deliver data from the cache, unless
      // redelivering a previously delivered result.
      skipCacheDataFor(fetchPolicy) ||
      // If this.options.query has @client(always: true) fields, we cannot
      // trust diff.result, since it was read from the cache without running
      // local resolvers (and it's too late to run resolvers now, since we must
      // return a result synchronously).
      this.queryManager.getDocumentInfo(this.query).hasForcedResolvers
    ) {
      // Fall through.
    } else if (this.waitForOwnResult && !prioritizeCacheValues) {
      // This would usually be a part of `QueryInfo.getDiff()`.
      // which we skip in the waitForOwnResult case since we are not
      // interested in the diff.
      this.queryInfo["updateWatch"]();
    } else {
      const diff = this.queryInfo.getDiff();

      result.partial = !diff.complete;

      if (diff.complete || this.options.returnPartialData) {
        result.data = diff.result;
      }

      if (result.data === null) {
        result.data = void 0 as any;
      }

      if (diff.complete) {
        // If the diff is complete, and we're using a FetchPolicy that
        // terminates after a complete cache read, we can assume the next result
        // we receive will have NetworkStatus.ready and !loading.
        if (
          diff.complete &&
          result.networkStatus === NetworkStatus.loading &&
          (fetchPolicy === "cache-first" || fetchPolicy === "cache-only")
        ) {
          result.networkStatus = NetworkStatus.ready;
          result.loading = false;
        }
      }

      // We need to check for both both `error` and `errors` field because there
      // are cases where sometimes `error` is set, but not `errors` and
      // vice-versa. This will be updated in the next major version when
      // `errors` is deprecated in favor of `error`.
      if (result.networkStatus === NetworkStatus.ready && result.error) {
        result.networkStatus = NetworkStatus.error;
      }

      if (
        __DEV__ &&
        !diff.complete &&
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

  public getCurrentResult(
    saveAsLastResult = true
  ): ApolloQueryResult<MaybeMasked<TData>> {
    return this.maskResult(this.getCurrentFullResult(saveAsLastResult));
  }

  // Compares newResult to the snapshot we took of this.lastResult when it was
  // first received.
  public isDifferentFromLastResult(
    newResult: ApolloQueryResult<TData>,
    variables?: TVariables
  ) {
    if (!this.last) {
      return true;
    }

    const documentInfo = this.queryManager.getDocumentInfo(this.query);
    const dataMasking = this.queryManager.dataMasking;
    const query = dataMasking ? documentInfo.nonReactiveQuery : this.query;

    const resultIsDifferent =
      dataMasking || documentInfo.hasNonreactiveDirective ?
        !equalByQuery(query, this.last.result, newResult, this.variables)
      : !equal(this.last.result, newResult);

    return (
      resultIsDifferent || (variables && !equal(this.last.variables, variables))
    );
  }

  private getLast<K extends keyof Last<TData, TVariables>>(
    key: K,
    variablesMustMatch?: boolean
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

  // TODO: Consider deprecating this function
  public getLastResult(
    variablesMustMatch?: boolean
  ): ApolloQueryResult<TData> | undefined {
    return this.getLast("result", variablesMustMatch);
  }

  // TODO: Consider deprecating this function
  public getLastError(variablesMustMatch?: boolean): ErrorLike | undefined {
    return this.getLast("error", variablesMustMatch);
  }

  // TODO: Consider deprecating this function
  public resetLastResults(): void {
    delete this.last;
    // TODO: This will need to be removed when tearing down an ObservableQuery
    // since the observable will terminate.
    this.isTornDown = false;
  }

  /**
   * Update the variables of this observable query, and fetch the new results.
   * This method should be preferred over `setVariables` in most use cases.
   *
   * @param variables - The new set of variables. If there are missing variables,
   * the previous values of those variables will be used.
   */
  public refetch(variables?: Partial<TVariables>): Promise<QueryResult<TData>> {
    const reobserveOptions: Partial<WatchQueryOptions<TVariables, TData>> = {
      // Always disable polling for refetches.
      pollInterval: 0,
    };

    // Unless the provided fetchPolicy always consults the network
    // (no-cache, network-only, or cache-and-network), override it with
    // network-only to force the refetch for this fetchQuery call.
    const { fetchPolicy } = this.options;
    if (fetchPolicy === "no-cache") {
      reobserveOptions.fetchPolicy = "no-cache";
    } else {
      reobserveOptions.fetchPolicy = "network-only";
    }

    if (__DEV__ && variables && hasOwnProperty.call(variables, "variables")) {
      const queryDef = getQueryDefinition(this.query);
      const vars = queryDef.variableDefinitions;
      if (!vars || !vars.some((v) => v.variable.name.value === "variables")) {
        invariant.warn(
          `Called refetch(%o) for query %o, which does not declare a $variables variable.
Did you mean to call refetch(variables) instead of refetch({ variables })?`,
          variables,
          queryDef.name?.value || queryDef
        );
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
    return this.reobserve({
      ...reobserveOptions,
      [newNetworkStatusSymbol]: NetworkStatus.refetch,
    });
  }

  /**
   * A function that helps you fetch the next set of results for a [paginated list field](https://www.apollographql.com/docs/react/pagination/core-api/).
   */
  public fetchMore<
    TFetchData = TData,
    TFetchVars extends OperationVariables = TVariables,
  >(
    fetchMoreOptions: FetchMoreQueryOptions<TFetchVars, TFetchData> & {
      updateQuery?: (
        previousQueryResult: Unmasked<TData>,
        options: {
          fetchMoreResult: Unmasked<TFetchData>;
          variables: TFetchVars;
        }
      ) => Unmasked<TData>;
    }
  ): Promise<QueryResult<TFetchData>> {
    const combinedOptions = {
      ...(fetchMoreOptions.query ? fetchMoreOptions : (
        {
          ...this.options,
          query: this.options.query,
          ...fetchMoreOptions,
          variables: {
            ...this.options.variables,
            ...fetchMoreOptions.variables,
          },
        }
      )),
      // The fetchMore request goes immediately to the network and does
      // not automatically write its result to the cache (hence no-cache
      // instead of network-only), because we allow the caller of
      // fetchMore to provide an updateQuery callback that determines how
      // the data gets written to the cache.
      fetchPolicy: "no-cache",
      notifyOnNetworkStatusChange: this.options.notifyOnNetworkStatusChange,
    } as WatchQueryOptions<TFetchVars, TFetchData>;

    combinedOptions.query = this.transformDocument(combinedOptions.query);

    const qid = this.queryManager.generateQueryId();

    // If a temporary query is passed to `fetchMore`, we don't want to store
    // it as the last query result since it may be an optimized query for
    // pagination. We will however run the transforms on the original document
    // as well as the document passed in `fetchMoreOptions` to ensure the cache
    // uses the most up-to-date document which may rely on runtime conditionals.
    this.lastQuery =
      fetchMoreOptions.query ?
        this.transformDocument(this.options.query)
      : combinedOptions.query;

    // Simulate a loading result for the original query with
    // result.networkStatus === NetworkStatus.fetchMore.
    const originalNetworkStatus = this.networkStatus;
    this.networkStatus = NetworkStatus.fetchMore;
    if (combinedOptions.notifyOnNetworkStatusChange) {
      this.observe();
    }

    const updatedQuerySet = new Set<DocumentNode>();

    const updateQuery = fetchMoreOptions?.updateQuery;
    const isCached = this.options.fetchPolicy !== "no-cache";

    if (!isCached) {
      invariant(
        updateQuery,
        "You must provide an `updateQuery` function when using `fetchMore` with a `no-cache` fetch policy."
      );
    }

    return this.queryManager
      .fetchQuery(qid, combinedOptions, NetworkStatus.fetchMore)
      .then((fetchMoreResult) => {
        this.queryManager.removeQuery(qid);

        if (this.networkStatus === NetworkStatus.fetchMore) {
          this.networkStatus = originalNetworkStatus;
        }

        if (isCached) {
          // Performing this cache update inside a cache.batch transaction ensures
          // any affected cache.watch watchers are notified at most once about any
          // updates. Most watchers will be using the QueryInfo class, which
          // responds to notifications by calling reobserveCacheFirst to deliver
          // fetchMore cache results back to this ObservableQuery.
          this.queryManager.cache.batch({
            update: (cache) => {
              const { updateQuery } = fetchMoreOptions;
              if (updateQuery) {
                cache.updateQuery(
                  {
                    query: this.query,
                    variables: this.variables,
                    returnPartialData: true,
                    optimistic: false,
                  },
                  (previous) =>
                    updateQuery(previous! as any, {
                      fetchMoreResult: fetchMoreResult.data as any,
                      variables: combinedOptions.variables as TFetchVars,
                    })
                );
              } else {
                // If we're using a field policy instead of updateQuery, the only
                // thing we need to do is write the new data to the cache using
                // combinedOptions.variables (instead of this.variables, which is
                // what this.updateQuery uses, because it works by abusing the
                // original field value, keyed by the original variables).
                cache.writeQuery({
                  query: combinedOptions.query,
                  variables: combinedOptions.variables,
                  data: fetchMoreResult.data as Unmasked<TFetchData>,
                });
              }
            },

            onWatchUpdated: (watch) => {
              // Record the DocumentNode associated with any watched query whose
              // data were updated by the cache writes above.
              updatedQuerySet.add(watch.query);
            },
          });
        } else {
          // There is a possibility `lastResult` may not be set when
          // `fetchMore` is called which would cause this to crash. This should
          // only happen if we haven't previously reported a result. We don't
          // quite know what the right behavior should be here since this block
          // of code runs after the fetch result has executed on the network.
          // We plan to let it crash in the meantime.
          //
          // If we get bug reports due to the `data` property access on
          // undefined, this should give us a real-world scenario that we can
          // use to test against and determine the right behavior. If we do end
          // up changing this behavior, this may require, for example, an
          // adjustment to the types on `updateQuery` since that function
          // expects that the first argument always contains previous result
          // data, but not `undefined`.
          const lastResult = this.getLast("result")!;
          const data = updateQuery!(lastResult.data as Unmasked<TData>, {
            fetchMoreResult: fetchMoreResult.data as Unmasked<TFetchData>,
            variables: combinedOptions.variables as TFetchVars,
          });

          this.reportResult(
            {
              ...lastResult,
              networkStatus: originalNetworkStatus,
              loading: isNetworkRequestInFlight(originalNetworkStatus),
              data: data as TData,
            },
            this.variables
          );
        }

        return this.maskResult(fetchMoreResult);
      })
      .finally(() => {
        // In case the cache writes above did not generate a broadcast
        // notification (which would have been intercepted by onWatchUpdated),
        // likely because the written data were the same as what was already in
        // the cache, we still want fetchMore to deliver its final loading:false
        // result with the unchanged data.
        if (isCached && !updatedQuerySet.has(this.query)) {
          this.reobserveCacheFirst();
        }
      });
  }

  // XXX the subscription variables are separate from the query variables.
  // if you want to update subscription variables, right now you have to do that separately,
  // and you can only do it by stopping the subscription and then subscribing again with new variables.
  /**
   * A function that enables you to execute a [subscription](https://www.apollographql.com/docs/react/data/subscriptions/), usually to subscribe to specific fields that were included in the query.
   *
   * This function returns _another_ function that you can call to terminate the subscription.
   */
  public subscribeToMore<
    TSubscriptionData = TData,
    TSubscriptionVariables extends OperationVariables = TVariables,
  >(
    options: SubscribeToMoreOptions<
      TData,
      TSubscriptionVariables,
      TSubscriptionData,
      TVariables
    >
  ): () => void {
    const subscription = this.queryManager
      .startGraphQLSubscription({
        query: options.document,
        variables: options.variables,
        context: options.context,
      })
      .subscribe({
        next: (subscriptionData) => {
          const { updateQuery, onError } = options;
          const { error } = subscriptionData;

          if (error) {
            if (onError) {
              onError(error);
            } else {
              invariant.error("Unhandled GraphQL subscription error", error);
            }

            return;
          }

          if (updateQuery) {
            this.updateQuery((previous, updateOptions) =>
              updateQuery(previous, {
                subscriptionData: subscriptionData as {
                  data: Unmasked<TSubscriptionData>;
                },
                ...updateOptions,
              })
            );
          }
        },
      });

    this.subscriptions.add(subscription);

    return () => {
      if (this.subscriptions.delete(subscription)) {
        subscription.unsubscribe();
      }
    };
  }

  /** @internal */
  public silentSetOptions(
    newOptions: Partial<WatchQueryOptions<TVariables, TData>>
  ) {
    const mergedOptions = compact(this.options, newOptions || {});
    assign(this.options, mergedOptions);
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
   * Note: the promise will return the last result immediately if the query is not active
   * (there are no subscribers).
   *
   * @param variables - The new set of variables. If there are missing variables,
   * the previous values of those variables will be used.
   */
  public async setVariables(
    variables: TVariables
  ): Promise<QueryResult<TData>> {
    if (equal(this.variables, variables)) {
      // If we have no observers, then we don't actually want to make a network
      // request. As soon as someone observes the query, the request will kick
      // off. For now, we just store any changes. (See #1077)
      return toQueryResult(this.subject.getValue());
    }

    this.options.variables = variables;

    // See comment above
    if (!this.hasObservers()) {
      return toQueryResult(this.subject.getValue());
    }

    return this.reobserve({
      // Reset options.fetchPolicy to its original value.
      fetchPolicy: this.options.initialFetchPolicy,
      variables,
      [newNetworkStatusSymbol]: NetworkStatus.setVariables,
    });
  }

  /**
   * A function that enables you to update the query's cached result without executing a followup GraphQL operation.
   *
   * See [using updateQuery and updateFragment](https://www.apollographql.com/docs/react/caching/cache-interaction/#using-updatequery-and-updatefragment) for additional information.
   */
  public updateQuery(mapFn: UpdateQueryMapFn<TData, TVariables>): void {
    const { queryManager } = this;
    const { result, complete } = queryManager.cache.diff<TData>({
      query: this.options.query,
      variables: this.variables,
      returnPartialData: true,
      optimistic: false,
    });

    const newResult = mapFn(
      result! as Unmasked<TData>,
      {
        variables: this.variables,
        complete: !!complete,
        previousData: result,
      } as UpdateQueryOptions<TData, TVariables>
    );

    if (newResult) {
      queryManager.cache.writeQuery({
        query: this.options.query,
        data: newResult,
        variables: this.variables,
      });

      queryManager.broadcastQueries();
    }
  }

  /**
   * A function that instructs the query to begin re-executing at a specified interval (in milliseconds).
   */
  public startPolling(pollInterval: number) {
    this.options.pollInterval = pollInterval;
    this.updatePolling();
  }

  /**
   * A function that instructs the query to stop polling after a previous call to `startPolling`.
   */
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
    options: WatchQueryOptions<TVariables, TData>
  ) {
    if (options.nextFetchPolicy) {
      const { fetchPolicy = "cache-first", initialFetchPolicy = fetchPolicy } =
        options;

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
        // having to call observableQuery.reobserve.
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
    newNetworkStatus: NetworkStatus,
    emitLoadingState: boolean,
    query?: DocumentNode
  ) {
    // TODO Make sure we update the networkStatus (and infer fetchVariables)
    // before actually committing to the fetch.
    const queryInfo = this.queryManager.getOrCreateQuery(this.queryId);
    queryInfo.setObservableQuery(this);
    return this.queryManager.fetchObservableWithInfo(
      queryInfo,
      options,
      newNetworkStatus,
      query,
      emitLoadingState
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
      options: { pollInterval },
    } = this;

    if (!pollInterval || !this.hasObservers()) {
      this.cancelPolling();
      return;
    }

    if (pollingInfo && pollingInfo.interval === pollInterval) {
      return;
    }

    invariant(
      pollInterval,
      "Attempted to start a polling query without a polling interval."
    );

    const info = pollingInfo || (this.pollingInfo = {} as any);
    info.interval = pollInterval;

    const maybeFetch = () => {
      if (this.pollingInfo) {
        if (
          !isNetworkRequestInFlight(this.networkStatus) &&
          !this.options.skipPollAttempt?.()
        ) {
          this.reobserve({
            // Most fetchPolicy options don't make sense to use in a polling context, as
            // users wouldn't want to be polling the cache directly. However, network-only and
            // no-cache are both useful for when the user wants to control whether or not the
            // polled results are written to the cache.
            fetchPolicy:
              this.options.initialFetchPolicy === "no-cache" ?
                "no-cache"
              : "network-only",
            [newNetworkStatusSymbol]: NetworkStatus.poll,
          }).then(poll, poll);
        } else {
          poll();
        }
      }
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

  // This differs from stopPolling in that it does not set pollInterval to 0
  private cancelPolling() {
    if (this.pollingInfo) {
      clearTimeout(this.pollingInfo.timeout);
      delete this.pollingInfo;
    }
  }

  private updateLastResult(
    newResult: ApolloQueryResult<TData>,
    variables = this.variables
  ) {
    let error = this.getLastError();
    // Preserve this.last.error unless the variables have changed.
    if (error && this.last && !equal(variables, this.last.variables)) {
      error = void 0;
    }
    return (this.last = {
      result:
        this.queryManager.assumeImmutableResults ?
          newResult
        : cloneDeep(newResult),
      variables,
      ...(error ? { error } : null),
    });
  }

  /**
   * Reevaluate the query, optionally against new options. New options will be
   * merged with the current options when given.
   */
  public reobserve(
    newOptions?: Partial<WatchQueryOptions<TVariables, TData>>
  ): Promise<QueryResult<MaybeMasked<TData>>> {
    this.isTornDown = false;
    let newNetworkStatus: NetworkStatus | undefined;

    if (newOptions) {
      newNetworkStatus = (newOptions as any)[newNetworkStatusSymbol];
      // Avoid setting the symbol option in this.options
      delete (newOptions as any)[newNetworkStatusSymbol];
    }

    const useDisposableObservable =
      // Refetching uses a disposable Observable to allow refetches using different
      // options/variables, without permanently altering the options of the
      // original ObservableQuery.
      newNetworkStatus === NetworkStatus.refetch ||
      // The fetchMore method does not actually call the reobserve method, but,
      // if it did, it would definitely use a disposable Observable.
      newNetworkStatus === NetworkStatus.fetchMore ||
      // Polling uses a disposable Observable so the polling options (which force
      // fetchPolicy to be "network-only" or "no-cache") won't override the original options.
      newNetworkStatus === NetworkStatus.poll;

    // Save the old variables, since Object.assign may modify them below.
    const oldVariables = this.options.variables;
    const oldFetchPolicy = this.options.fetchPolicy;

    const mergedOptions = compact(this.options, newOptions || {});
    const options =
      useDisposableObservable ?
        // Disposable Observable fetches receive a shallow copy of this.options
        // (merged with newOptions), leaving this.options unmodified.
        mergedOptions
      : assign(this.options, mergedOptions);

    // Don't update options.query with the transformed query to avoid
    // overwriting this.options.query when we aren't using a disposable concast.
    // We want to ensure we can re-run the custom document transforms the next
    // time a request is made against the original query.
    const query = this.transformDocument(options.query);
    const { fetchPolicy } = options;

    this.lastQuery = query;

    // Allow variables to get reevaluated when passing variables: undefined,
    // otherwise `compact` will ignore the `variables` key. Note: This may
    // mutate this.options.variables when not using a disposable observable.
    // This is intentional
    options.variables =
      newOptions && "variables" in newOptions ?
        this.queryManager.getVariables(query, newOptions.variables)
      : options.variables;

    if (!useDisposableObservable) {
      // We can skip calling updatePolling if we're not changing this.options.
      this.updatePolling();

      // Reset options.fetchPolicy to its original value when variables change,
      // unless a new fetchPolicy was provided by newOptions.
      if (
        newOptions &&
        newOptions.variables &&
        !equal(newOptions.variables, oldVariables) &&
        // Don't mess with the fetchPolicy if it's currently "standby".
        fetchPolicy !== "standby" &&
        // If we're changing the fetchPolicy anyway, don't try to change it here
        // using applyNextFetchPolicy. The explicit options.fetchPolicy wins.
        (fetchPolicy === oldFetchPolicy ||
          // A `nextFetchPolicy` function has even higher priority, though,
          // so in that case `applyNextFetchPolicy` must be called.
          typeof options.nextFetchPolicy === "function")
      ) {
        this.applyNextFetchPolicy("variables-changed", options);
        if (newNetworkStatus === void 0) {
          newNetworkStatus = NetworkStatus.setVariables;
        }
      }
    }

    const oldNetworkStatus = this.networkStatus;

    if (!newNetworkStatus) {
      newNetworkStatus = NetworkStatus.loading;

      if (
        oldNetworkStatus !== NetworkStatus.loading &&
        newOptions?.variables &&
        !equal(newOptions.variables, oldVariables)
      ) {
        newNetworkStatus = NetworkStatus.setVariables;
      }

      // QueryManager does not emit any values for standby fetch policies so we
      // want ensure that the networkStatus remains ready.
      if (fetchPolicy === "standby") {
        newNetworkStatus = NetworkStatus.ready;
      }
    }

    if (fetchPolicy === "standby") {
      this.cancelPolling();
    }

    this.networkStatus = newNetworkStatus;
    this.waitForOwnResult &&= skipCacheDataFor(options.fetchPolicy);
    const finishWaitingForOwnResult = () => {
      if (this.linkObservable === observable) {
        this.waitForOwnResult = false;
      }
    };

    const variables = options.variables && { ...options.variables };
    const { notifyOnNetworkStatusChange = true } = options;
    const { observable, fromLink } = this.fetch(
      options,
      newNetworkStatus,
      notifyOnNetworkStatusChange &&
        oldNetworkStatus !== newNetworkStatus &&
        isNetworkRequestInFlight(newNetworkStatus),
      query
    );
    const observer: Partial<Observer<ApolloQueryResult<TData>>> = {
      next: (result) => {
        if (equal(this.variables, variables)) {
          finishWaitingForOwnResult();
          this.reportResult(result, variables);
        }
      },
      error: (error) => {
        if (equal(this.variables, variables)) {
          finishWaitingForOwnResult();
          this.reportError(error, variables);
        }
      },
    };

    if (!useDisposableObservable && (fromLink || !this.linkSubscription)) {
      if (this.linkSubscription) {
        this.linkSubscription.unsubscribe();
      }

      this.linkObservable = observable;
      this.linkSubscription = observable.subscribe(observer);
    } else {
      observable.subscribe(observer);
    }

    return preventUnhandledRejection(
      // Note: lastValueFrom will create a separate subscription to the
      // observable which means that terminating this ObservableQuery will not
      // cancel the request from the link chain.
      lastValueFrom(observable, {
        // This default value should only be used when using a `fetchPolicy` of
        // `standby` since that fetch policy completes without emitting a
        // result. Since we are converting this to a QueryResult type, we
        // omit the extra fields from ApolloQueryResult in the default value.
        defaultValue: { data: undefined } as ApolloQueryResult<TData>,
      }).then((result) => toQueryResult(this.maskResult(result)))
    );
  }

  // (Re)deliver the current result to this.observers without applying fetch
  // policies or making network requests.
  private observe() {
    this.reportResult(
      // Passing false is important so that this.getCurrentResult doesn't
      // save the fetchMore result as this.lastResult, causing it to be
      // ignored due to the this.isDifferentFromLastResult check in
      // this.reportResult.
      this.getCurrentFullResult(false),
      this.variables
    );
  }

  private reportResult(
    result: ApolloQueryResult<TData>,
    variables: TVariables | undefined
  ) {
    const lastError = this.getLastError();
    const isDifferent = this.isDifferentFromLastResult(result, variables);
    // Update the last result even when isDifferentFromLastResult returns false,
    // because the query may be using the @nonreactive directive, and we want to
    // save the the latest version of any nonreactive subtrees (in case
    // getCurrentResult is called), even though we skip broadcasting changes.
    this.updateLastResult(result, variables);
    this.networkStatus = result.networkStatus;
    if (lastError || isDifferent) {
      this.subject.next(this.maskResult(result));
    }
  }

  private reportError(error: Error, variables: TVariables | undefined) {
    // Since we don't get the current result on errors, only the error, we
    // must mirror the updates that occur in QueryStore.markQueryError here
    const errorResult: ApolloQueryResult<TData> = {
      data: undefined,
      partial: true,
      ...this.getLastResult(),
      error,
      networkStatus: NetworkStatus.error,
      loading: false,
    };

    this.updateLastResult(errorResult, variables);
    this.networkStatus = NetworkStatus.error;
    this.last!.error = error;
    this.subject.next(errorResult);
  }

  public hasObservers() {
    return this.subject.observed;
  }

  private tearDownQuery() {
    if (this.isTornDown) return;
    if (this.linkObservable && this.linkSubscription) {
      this.linkSubscription.unsubscribe();
      delete this.linkObservable;
      delete this.linkSubscription;
    }

    this.stopPolling();
    // stop all active GraphQL subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.queryManager.stopQuery(this.queryId);
    this.isTornDown = true;
  }

  private transformDocument(document: DocumentNode) {
    return this.queryManager.transform(document);
  }

  private maskResult<T extends { data: any }>(result: T): T {
    return result && "data" in result ?
        {
          ...result,
          data: this.queryManager.maskOperation({
            document: this.query,
            data: result.data,
            fetchPolicy: this.options.fetchPolicy,
            id: this.queryId,
          }),
        }
      : result;
  }

  private dirty: boolean = false;

  private notifyTimeout?: ReturnType<typeof setTimeout>;

  /** @internal */
  protected resetNotifications() {
    this.cancelNotifyTimeout();
    this.dirty = false;
  }

  private cancelNotifyTimeout() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = void 0;
    }
  }

  /** @internal */
  protected scheduleNotify() {
    if (this.dirty) return;
    this.dirty = true;
    if (!this.notifyTimeout) {
      this.notifyTimeout = setTimeout(() => this.notify(), 0);
    }
  }

  /** @internal */
  protected notify() {
    this.cancelNotifyTimeout();

    if (this.dirty) {
      if (
        this.options.fetchPolicy == "cache-only" ||
        this.options.fetchPolicy == "cache-and-network" ||
        !isNetworkRequestInFlight(this.networkStatus)
      ) {
        const diff = this.queryInfo.getDiff();
        if (diff.fromOptimisticTransaction) {
          // If this diff came from an optimistic transaction, deliver the
          // current cache data to the ObservableQuery, but don't perform a
          // reobservation, since oq.reobserveCacheFirst might make a network
          // request, and we never want to trigger network requests in the
          // middle of optimistic updates.
          this.observe();
        } else {
          // Otherwise, make the ObservableQuery "reobserve" the latest data
          // using a temporary fetch policy of "cache-first", so complete cache
          // results have a chance to be delivered without triggering additional
          // network requests, even when options.fetchPolicy is "network-only"
          // or "cache-and-network". All other fetch policies are preserved by
          // this method, and are handled by calling oq.reobserve(). If this
          // reobservation is spurious, isDifferentFromLastResult still has a
          // chance to catch it before delivery to ObservableQuery subscribers.
          this.reobserveCacheFirst();
        }
      }
    }

    this.dirty = false;
  }

  // Reobserve with fetchPolicy effectively set to "cache-first", triggering
  // delivery of any new data from the cache, possibly falling back to the network
  // if any cache data are missing. This allows _complete_ cache results to be
  // delivered without also kicking off unnecessary network requests when
  // this.options.fetchPolicy is "cache-and-network" or "network-only". When
  // this.options.fetchPolicy is any other policy ("cache-first", "cache-only",
  // "standby", or "no-cache"), we call this.reobserve() as usual.
  private reobserveCacheFirst() {
    const { fetchPolicy, nextFetchPolicy } = this.options;

    if (fetchPolicy === "cache-and-network" || fetchPolicy === "network-only") {
      return this.reobserve({
        fetchPolicy: "cache-first",
        // Use a temporary nextFetchPolicy function that replaces itself with the
        // previous nextFetchPolicy value and returns the original fetchPolicy.
        nextFetchPolicy(
          this: WatchQueryOptions<TVariables, TData>,
          currentFetchPolicy: WatchQueryFetchPolicy,
          context: NextFetchPolicyContext<TData, TVariables>
        ) {
          // Replace this nextFetchPolicy function in the options object with the
          // original this.options.nextFetchPolicy value.
          this.nextFetchPolicy = nextFetchPolicy;
          // If the original nextFetchPolicy value was a function, give it a
          // chance to decide what happens here.
          if (typeof this.nextFetchPolicy === "function") {
            return this.nextFetchPolicy(currentFetchPolicy, context);
          }
          // Otherwise go back to the original this.options.fetchPolicy.
          return fetchPolicy!;
        },
      });
    }

    return this.reobserve();
  }
}

export function logMissingFieldErrors(
  missing: MissingFieldError | MissingTree | undefined
) {
  if (__DEV__ && missing) {
    invariant.debug(`Missing cache result fields: %o`, missing);
  }
}

function skipCacheDataFor(
  fetchPolicy?: WatchQueryFetchPolicy /* `undefined` would mean `"cache-first"` */
) {
  return (
    fetchPolicy === "network-only" ||
    fetchPolicy === "no-cache" ||
    fetchPolicy === "standby"
  );
}
