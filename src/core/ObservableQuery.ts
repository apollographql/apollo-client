import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";
import { Slot } from "optimism";
import type {
  InteropObservable,
  ObservableNotification,
  Observer,
  OperatorFunction,
  Subscribable,
  Subscription,
} from "rxjs";
import { distinctUntilChanged, merge, Observable, share } from "rxjs";
import {
  BehaviorSubject,
  dematerialize,
  filter,
  lastValueFrom,
  map,
  pipe,
  Subject,
  tap,
} from "rxjs";

import type { MissingFieldError } from "@apollo/client/cache";
import type { MissingTree } from "@apollo/client/cache";
import type { MaybeMasked, Unmasked } from "@apollo/client/masking";
import {
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
  DefaultContext,
  ErrorLike,
  OperationVariables,
  QueryNotification,
  QueryResult,
  TypedDocumentNode,
} from "./types.js";
import type {
  ErrorPolicy,
  FetchMoreQueryOptions,
  NextFetchPolicyContext,
  RefetchWritePolicy,
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

interface TrackedOperation {
  /**
   * The network status that should be caused by this operation.
   * Currently not used, might get removed
   */
  networkStatus: NetworkStatus;
  /**
   * This NetworkStatus will be used to override the current networkStatus
   */
  override?: NetworkStatus;
  /**
   * Will abort tracking the operation from this ObservableQuery and remove it from `activeOperations`
   */
  abort: () => void;
  /**
   * `query` that was used by the `ObservableQuery` as the "main query" at the time the operation was started
   * This is not necessarily the same query as the query the operation itself is doing.
   */
  query: DocumentNode;
  variables: OperationVariables;
}

const newNetworkStatusSymbol: any = Symbol();
export const uninitialized: ApolloQueryResult<any> = {
  loading: true,
  networkStatus: NetworkStatus.loading,
  data: undefined,
  partial: true,
};

export const empty: ApolloQueryResult<any> = {
  loading: false,
  networkStatus: NetworkStatus.ready,
  data: undefined,
  partial: true,
};

export declare namespace ObservableQuery {
  export type Options<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy: WatchQueryFetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#nextFetchPolicy:member} */
    nextFetchPolicy?:
      | WatchQueryFetchPolicy
      | ((
          this: WatchQueryOptions<TVariables, TData>,
          currentFetchPolicy: WatchQueryFetchPolicy,
          context: NextFetchPolicyContext<TData, TVariables>
        ) => WatchQueryFetchPolicy);

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#initialFetchPolicy:member} */
    initialFetchPolicy: WatchQueryFetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
    refetchWritePolicy?: RefetchWritePolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#pollInterval:member} */
    pollInterval?: number;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#notifyOnNetworkStatusChange:member} */
    notifyOnNetworkStatusChange?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
    returnPartialData?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skipPollAttempt:member} */
    skipPollAttempt?: () => boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#query:member} */
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
    variables: TVariables;
  };
}

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

  public readonly options: ObservableQuery.Options<TData, TVariables>;
  public readonly queryId: string;
  public readonly queryName?: string;

  // The `query` computed property will always reflect the document transformed
  // by the last run query. `this.options.query` will always reflect the raw
  // untransformed query to ensure document transforms with runtime conditionals
  // are run on the original document.
  public get query(): TypedDocumentNode<TData, TVariables> {
    return this.lastQuery;
  }

  /**
   * An object containing the variables that were provided for the query.
   */
  public get variables(): TVariables {
    return this.options.variables;
  }

  private cacheSubscription?: Subscription;
  private input: Subject<QueryNotification.Value<TData, TVariables>>;
  private subject: BehaviorSubject<{
    query: DocumentNode;
    variables?: TVariables;
    result: ApolloQueryResult<MaybeMasked<TData>>;
  }>;
  private readonly observable: Observable<
    ApolloQueryResult<MaybeMasked<TData>>
  >;

  private isTornDown: boolean;
  private queryManager: QueryManager;
  private subscriptions = new Set<Subscription>();

  //private waitForOwnResult: boolean;
  private last?: Last<TData, TVariables>;
  private lastError?: {
    query: DocumentNode;
    variables?: TVariables;
    error: ErrorLike;
  };
  private lastQuery: DocumentNode;

  private queryInfo: QueryInfo;

  private linkSubscription?: Subscription;

  private pollingInfo?: {
    interval: number;
    timeout: ReturnType<typeof setTimeout>;
  };

  private get networkStatus(): NetworkStatus {
    return this.subject.getValue().result.networkStatus;
  }

  /**
   * The last known emitted value when `reobserve` is called.
   * This value will be forced to "re-emit" even if it is the same value as the
   * previously emitted value.
   */
  private reemitEvenIfEqual?: ApolloQueryResult<TData>;

  constructor({
    queryManager,
    queryInfo,
    options,
  }: {
    queryManager: QueryManager;
    queryInfo: QueryInfo;
    options: WatchQueryOptions<TVariables, TData>;
  }) {
    let startedInactive = ObservableQuery.inactiveOnCreation.getValue();

    // related classes
    this.queryInfo = queryInfo;
    this.queryManager = queryManager;

    // active state
    //this.waitForOwnResult = skipCacheDataFor(options.fetchPolicy);
    this.isTornDown = false;

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

    this.lastQuery = options.query;

    this.options = {
      ...options,

      // Remember the initial options.fetchPolicy so we can revert back to this
      // policy when variables change. This information can also be specified
      // (or overridden) by providing options.initialFetchPolicy explicitly.
      initialFetchPolicy,

      // This ensures this.options.fetchPolicy always has a string value, in
      // case options.fetchPolicy was not provided.
      fetchPolicy,
      variables: this.getVariablesWithDefaults(options.variables),
    };

    this.subject = new BehaviorSubject<{
      query: DocumentNode;
      variables?: TVariables;
      result: ApolloQueryResult<MaybeMasked<TData>>;
    }>({
      query: this.query,
      variables: this.variables,
      result: uninitialized,
    });
    this.observable = this.subject.pipe(
      tap({
        subscribe: () => {
          if (startedInactive) {
            queryManager["queries"].set(this.queryId, queryInfo);
            startedInactive = false;
          }
          if (!this.subject.observed) {
            if (this.subject.value.result === uninitialized) {
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
              this.subject.next({
                variables: this.variables,
                query: this.query,
                result: this.getInitialResult({ observed: true }),
              });
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
      distinctUntilChanged((previous, current) => {
        const documentInfo = this.queryManager.getDocumentInfo(current.query);
        const dataMasking = this.queryManager.dataMasking;
        const query =
          dataMasking ? documentInfo.nonReactiveQuery : current.query;

        const resultIsEqual =
          dataMasking || documentInfo.hasNonreactiveDirective ?
            equalByQuery(
              query,
              previous.result,
              current.result,
              current.variables
            )
          : equal(previous.result, current.result);

        return (
          resultIsEqual &&
          (!current.variables ||
            equal(previous.variables, current.variables)) &&
          !equal(previous.result, this.reemitEvenIfEqual)
        );
      }),
      tap(() => {
        // we only want to reemit if equal once, and if the value changed
        // we also don't want to reemit in the future,
        // so no matter what value is emitted here, we can safely
        // reset `this.reemitEvenIfEqual`
        this.reemitEvenIfEqual = undefined;
      }),
      map((value) => value.result),
      filter((result) => {
        return (
          this.options.fetchPolicy !== "standby" &&
          (this.options.notifyOnNetworkStatusChange ||
            !result.loading ||
            // data could be defined for cache-and-network fetch policies
            // when emitting the cache result while loading the network result
            !!result.data) &&
          // only the case if the query has been reset - we don't want to emit
          // an event for that, this will likely be followed by a refetch
          // immediately
          result !== uninitialized
        );
      })
    );

    this["@@observable"] = () => this;
    if (Symbol.observable) {
      this[Symbol.observable] = () => this;
    }
    this.pipe = this.observable.pipe.bind(this.observable);
    this.subscribe = this.observable.subscribe.bind(this.observable);

    this.input = new Subject();
    // we want to feed many streams into `this.subject`, but none of them should
    // be able to close `this.input`
    this.input.complete = () => {};
    this.input.pipe(this.operator).subscribe(this.subject);
    this.input.subscribe({
      next: (notification) => {
        if (
          notification.source == "cache" &&
          !isNetworkRequestInFlight(notification.value.networkStatus) &&
          notification.value.partial
        ) {
          const previousResult = this.subject.getValue().result;
          // if the query is currently in an error state, an incoming parital
          // result should not trigger a notify - we have no reason to assume
          // that the error is resolved
          if (previousResult.networkStatus !== NetworkStatus.error) {
            this.scheduleNotify();
          }
        }
      },
    });

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

  private getCacheDiff({
    query = this.query,
    variables = this.variables,
    returnPartialData = true,
    optimistic = true,
  } = {}) {
    return this.queryManager.cache.diff<TData>({
      query,
      variables,
      returnPartialData,
      optimistic,
    });
  }

  private getInitialResult({
    query = this.query,
    variables = this.variables,
    observed = this.subject.observed,
  } = {}): ApolloQueryResult<MaybeMasked<TData>> {
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
      const diff = this.getCacheDiff({
        query,
        variables,
      });

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
        return observed ?
            {
              ...defaultResult,
              loading: false,
              networkStatus: NetworkStatus.ready,
            }
          : defaultResult;

      default:
        return defaultResult;
    }
  }

  private resubscribeCache() {
    const { variables, fetchPolicy } = this.options;
    const query = this.query;

    this.cacheSubscription?.unsubscribe();

    if (fetchPolicy === "standby" || fetchPolicy === "no-cache") {
      return;
    }
    const observable = new Observable<
      QueryNotification.Value<TData, TVariables>
    >((observer) => {
      return this.queryManager.cache.watch({
        query,
        variables,
        optimistic: true,
        watcher: this,
        callback: (diff) => {
          if (diff.result) {
            observer.next({
              kind: "N",
              value: {
                data: diff.result as TData,
                networkStatus: NetworkStatus.ready,
                loading: false,
                error: undefined,
                partial: !diff.complete,
              },
              source: "cache",
              query,
              variables,
            });
          }
        },
      });
    }).pipe(
      tap({
        subscribe() {
          console.log("subscribing to cache for", {
            query,
            variables,
          });
        },
        unsubscribe() {
          console.log("unsubscribing from cache for", {
            query,
            variables,
          });
        },
      })
    );
    this.cacheSubscription = observable.subscribe(this.input);
  }

  public getCurrentResult(): ApolloQueryResult<MaybeMasked<TData>> {
    const value = this.subject.getValue().result;
    return value !== uninitialized ? value : this.getInitialResult();
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
    if (
      this.lastError &&
      (!variablesMustMatch ||
        (this.lastError.query == this.query &&
          equal(this.lastError.variables, this.variables)))
    ) {
      return this.lastError.error;
    }
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
    const reobserveOptions: Partial<
      ObservableQuery.Options<TData, TVariables>
    > = {
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

    if (variables && !equal(this.variables, variables)) {
      // Update the existing options with new variables
      reobserveOptions.variables = this.options.variables =
        this.getVariablesWithDefaults({ ...this.variables, ...variables });
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
            ...this.variables,
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

    const { finalize, pushNotification } = this.pushOperation(
      NetworkStatus.fetchMore
    );
    if (this.options.notifyOnNetworkStatusChange !== false) {
      pushNotification({
        source: "newNetworkStatus",
        kind: "N",
        value: {
          networkStatus: NetworkStatus.fetchMore,
        },
      });
    }
    return this.queryManager
      .fetchQuery(qid, combinedOptions, NetworkStatus.fetchMore)
      .then((fetchMoreResult) => {
        this.queryManager.removeQuery(qid);

        finalize();

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
          const lastResult = this.getCurrentResult();
          const data = updateQuery!(lastResult.data as Unmasked<TData>, {
            fetchMoreResult: fetchMoreResult.data as Unmasked<TFetchData>,
            variables: combinedOptions.variables as TFetchVars,
          });
          // was reportResult
          pushNotification({
            kind: "N",
            value: {
              ...lastResult,
              networkStatus: originalNetworkStatus,
              // will be overwritten anyways, just here for types sake
              loading: false,
              data: data as TData,
            },
            source: "network",
            fetchPolicy: combinedOptions.fetchPolicy || "cache-first",
            reason: NetworkStatus.fetchMore,
          });
        }

        return this.maskResult(fetchMoreResult);
      })
      .finally(() => {
        // call `finalize` a second time in case the `.then` case above was not reached
        finalize();

        // In case the cache writes above did not generate a broadcast
        // notification (which would have been intercepted by onWatchUpdated),
        // likely because the written data were the same as what was already in
        // the cache, we still want fetchMore to deliver its final loading:false
        // result with the unchanged data.
        if (isCached && !updatedQuerySet.has(this.query)) {
          pushNotification({
            kind: "N",
            source: "newNetworkStatus",
            value: { networkStatus: NetworkStatus.ready },
          });
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
    newOptions: Partial<ObservableQuery.Options<TData, TVariables>>
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
    variables = this.getVariablesWithDefaults(variables);

    if (equal(this.variables, variables)) {
      // If we have no observers, then we don't actually want to make a network
      // request. As soon as someone observes the query, the request will kick
      // off. For now, we just store any changes. (See #1077)
      return toQueryResult(this.subject.getValue().result);
    }

    this.options.variables = variables;

    // See comment above
    if (!this.hasObservers()) {
      return toQueryResult(this.subject.getValue().result);
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
    const { result, complete } = this.getCacheDiff({ optimistic: false });

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
        options.fetchPolicy = options.nextFetchPolicy.call(
          options as any,
          fetchPolicy,
          { reason, options, observable: this, initialFetchPolicy }
        );
      } else if (reason === "variables-changed") {
        options.fetchPolicy = initialFetchPolicy;
      } else {
        options.fetchPolicy = options.nextFetchPolicy;
      }
    }

    return options.fetchPolicy;
  }

  private fetch(
    options: ObservableQuery.Options<TData, TVariables>,
    newNetworkStatus: NetworkStatus,
    emitLoadingState: boolean,
    query?: DocumentNode
  ) {
    // console.log("fetch", options);
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
          console.log("maybeFetch");
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

  /**
   * Reevaluate the query, optionally against new options. New options will be
   * merged with the current options when given.
   */
  public reobserve(
    newOptions?: Partial<ObservableQuery.Options<TData, TVariables>>
  ): Promise<QueryResult<MaybeMasked<TData>>> {
    console.trace(`ObservableQuery.reobserve(%o)`, newOptions);
    this.resetNotifications();
    this.isTornDown = false;
    let newNetworkStatus: NetworkStatus | undefined;

    if (newOptions) {
      newNetworkStatus = (newOptions as any)[newNetworkStatusSymbol];
      // Avoid setting the symbol option in this.options
      delete (newOptions as any)[newNetworkStatusSymbol];
    }

    const useDisposableObservable =
      // Refetching uses a disposable Observable to allow refetches using different
      // options, without permanently altering the options of the
      // original ObservableQuery.
      newNetworkStatus === NetworkStatus.refetch ||
      // The fetchMore method does not actually call the reobserve method, but,
      // if it did, it would definitely use a disposable Observable.
      newNetworkStatus === NetworkStatus.fetchMore ||
      // Polling uses a disposable Observable so the polling options (which force
      // fetchPolicy to be "network-only" or "no-cache") won't override the original options.
      newNetworkStatus === NetworkStatus.poll;

    // Save the old variables, since Object.assign may modify them below.
    const oldVariables = this.variables;
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

    // Reevaluate variables to allow resetting variables with variables: undefined,
    // otherwise `compact` will ignore the `variables` key in `newOptions`. We
    // do this after we run the query transform to ensure we get default
    // variables from the transformed query.
    //
    // Note: updating options.variables may mutate this.options.variables
    // in the case of a non-disposable query. This is intentional.
    if (newOptions && "variables" in newOptions) {
      options.variables = this.getVariablesWithDefaults(newOptions.variables);
    }

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

    if (
      newNetworkStatus == NetworkStatus.refetch ||
      newNetworkStatus == NetworkStatus.setVariables
    ) {
      this.reemitEvenIfEqual = this.subject.getValue().result;
    }

    if (fetchPolicy === "standby") {
      this.cancelPolling();
    }
    if (
      !useDisposableObservable ||
      // TODO: investigate - should `refetch` actually be a disposable Query?
      newNetworkStatus === NetworkStatus.refetch
    ) {
      this.resubscribeCache();
    }

    const { notifyOnNetworkStatusChange = true } = options;
    const { observable, fromLink } = this.fetch(
      options,
      newNetworkStatus,
      notifyOnNetworkStatusChange &&
        oldNetworkStatus !== newNetworkStatus &&
        isNetworkRequestInFlight(newNetworkStatus),
      query
    );

    if (!useDisposableObservable && (fromLink || !this.linkSubscription)) {
      if (this.linkSubscription) {
        this.linkSubscription.unsubscribe();
      }

      this.linkSubscription = this.trackOperation(observable, newNetworkStatus);
    } else {
      this.trackOperation(observable, newNetworkStatus);
    }

    return preventUnhandledRejection(
      // Note: lastValueFrom will create a separate subscription to the
      // observable which means that terminating this ObservableQuery will not
      // cancel the request from the link chain.
      lastValueFrom(
        observable.pipe(
          filter((value) => value.source !== "newNetworkStatus"),
          dematerialize()
        ),
        {
          // This default value should only be used when using a `fetchPolicy` of
          // `standby` since that fetch policy completes without emitting a
          // result. Since we are converting this to a QueryResult type, we
          // omit the extra fields from ApolloQueryResult in the default value.
          defaultValue: { data: undefined } as ApolloQueryResult<TData>,
        }
      )
        .then((result) => toQueryResult(this.maskResult(result)))
        .then((v) => {
          console.log("reobserve finished", v);
          return v;
        })
    );
  }

  // (Re)deliver the current result to this.observers without applying fetch
  // policies or making network requests.
  private observe() {
    // TODO  - is this method even called now?
  }

  public hasObservers() {
    return this.subject.observed;
  }

  private tearDownQuery() {
    if (this.isTornDown) return;
    this.cacheSubscription?.unsubscribe();
    if (this.linkSubscription) {
      this.linkSubscription.unsubscribe();
      delete this.linkSubscription;
    }

    this.stopPolling();
    // stop all active GraphQL subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.queryManager.stopQuery(this.queryId);
    this.isTornDown = true;
    this.reset();
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
  private resetNotifications() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = void 0;
    }
    this.dirty = false;
  }

  /** @internal */
  private scheduleNotify() {
    if (this.dirty) return;
    this.dirty = true;
    if (!this.notifyTimeout) {
      this.notifyTimeout = setTimeout(() => this.notify(), 0);
    }
  }

  /** @internal */
  public notify() {
    const { dirty } = this;
    this.resetNotifications();

    if (dirty) {
      if (
        // TODO: this seems wrong for the change to `reobserveFromNetwork` we did here
        this.options.fetchPolicy == "cache-only" ||
        this.options.fetchPolicy == "cache-and-network" ||
        !isNetworkRequestInFlight(this.networkStatus)
      ) {
        const diff = this.getCacheDiff();
        if (!diff.fromOptimisticTransaction && !diff.complete) {
          // Otherwise, make the ObservableQuery "reobserve" the latest data
          // using a temporary fetch policy of "cache-first", so complete cache
          // results have a chance to be delivered without triggering additional
          // network requests, even when options.fetchPolicy is "network-only"
          // or "cache-and-network". All other fetch policies are preserved by
          // this method, and are handled by calling oq.reobserve(). If this
          // reobservation is spurious, distinctUntilChanged still has a
          // chance to catch it before delivery to ObservableQuery subscribers.
          this.reobserveFromNetwork();
        }
      }
    }
  }

  private activeOperations = new Set<TrackedOperation>();
  private pushOperation(networkStatus: NetworkStatus): {
    finalize: () => void;
    pushNotification: (
      notification: QueryNotification.ValueWithoutMeta<TData, TVariables>
    ) => void;
  } {
    let aborted = false;
    // track query and variables from the start of the operation
    const { query, variables } = this;
    const finalize = () => {
      this.activeOperations.delete(operation);
    };
    const operation: TrackedOperation = {
      networkStatus,
      override: networkStatus,
      abort: () => {
        aborted = true;
        finalize();
      },
      query,
      variables,
    };
    this.activeOperations.add(operation);
    return {
      finalize,
      pushNotification: (
        notification: QueryNotification.ValueWithoutMeta<TData, TVariables>
      ) => {
        if (!aborted) {
          this.input.next({
            ...notification,
            query,
            variables,
          } as QueryNotification.Value<TData, TVariables>);
        }
      },
    };
  }

  private trackOperation(
    observable: Observable<
      QueryNotification.ValueWithoutMeta<TData, TVariables>
    >,
    networkStatus: NetworkStatus
  ) {
    // track query and variables from the start of the operation
    const { query, variables } = this;
    const operation: TrackedOperation = {
      networkStatus,
      abort: () => subscription.unsubscribe(),
      query,
      variables,
    };
    this.activeOperations.add(operation);
    const subscription = observable
      .pipe(
        tap({
          next: (value) => {
            if (value.kind === "N") {
              operation.override = value.value.networkStatus;
            } else {
              delete operation.override;
            }
          },
          finalize: () => this.activeOperations.delete(operation),
        }),
        map((valueWithoutMeta) => ({
          ...valueWithoutMeta,
          query,
          variables,
        }))
      )
      .subscribe(this.input);
    return subscription;
  }

  private caclulateNetworkStatus(baseNetworkStatus: NetworkStatus) {
    // in the future, this could be more complex logic, e.g. "refetch" and
    // "fetchMore" having priority over "polling" or "loading" network statuses
    // as for now we just take the "latest" operation that is still active,
    // as that lines up best with previous behavior[]
    if (baseNetworkStatus === NetworkStatus.error) {
      //  return baseNetworkStatus;
    }
    const operation = Array.from(this.activeOperations.values()).findLast(
      (operation) => operation.override !== undefined
    );
    return operation?.override ?? baseNetworkStatus;
  }

  /**
   * @internal
   * Called from `clearStore`.
   * * resets the query to its initial state
   * * cancels all active operations and their subscriptions
   */
  public reset() {
    this.setResult(
      // exception for cache-only queries - we reset them into a "ready" state
      // as we won't trigger a refetch for them
      this.options.fetchPolicy === "cache-only" ? empty : uninitialized
    );
    this.activeOperations.forEach((operation) => operation.abort());
  }

  /** @internal */
  public setResult(result: ApolloQueryResult<TData>) {
    this.input.next({
      source: "setResult",
      kind: "N",
      value: result,
      query: this.query,
      variables: this.variables,
    });
  }

  private operator: OperatorFunction<
    QueryNotification.Value<TData, TVariables>,
    QueryNotification.InternalResult<
      ApolloQueryResult<TData>,
      TData,
      TVariables
    >
  > = pipe((obs) => {
    obs = obs.pipe(
      tap({
        next: ({ query, ...incoming }) => {
          console.dir(
            {
              incoming,
              current: {
                variables: this.variables,
                fetchPolicy: this.options.fetchPolicy,
              },
            },
            { depth: 5 }
          );
        },
      }),
      share()
    );

    const fromCache = obs.pipe(
      filter((v): v is typeof v & { source: "cache" } => v.source === "cache")
    );
    const fromNetwork = obs.pipe(
      filter(
        (v): v is typeof v & { source: "network" } => v.source === "network"
      )
    );

    const setResult = obs.pipe(
      filter(
        (v): v is typeof v & { source: "setResult" } => v.source === "setResult"
      )
    );
    // TODO
    // const fromFetchMore = obs.pipe(
    //   filter(
    //     (v): v is FetchMoreTransportValue => v.meta.source === "fetchMore"
    //   )
    // );
    const fromNetworkStatus = obs.pipe(
      filter(
        (v): v is typeof v & { source: "newNetworkStatus" } =>
          v.source === "newNetworkStatus"
      )
    );

    function isEqualQuery(
      a: { query: DocumentNode; variables?: OperationVariables },
      b: { query: DocumentNode; variables?: OperationVariables }
    ) {
      return a.query === b.query && equal(a.variables || {}, b.variables || {});
    }

    const filterForCurrentQuery = <
      T extends QueryNotification.Meta<TData, TVariables>,
    >(
      value: T
    ) => isEqualQuery(value, this);

    return merge(
      setResult.pipe(
        map(({ variables, query, value }) => ({
          variables,
          query,
          result: value,
        }))
      ),
      merge(
        fromCache.pipe(
          filter(filterForCurrentQuery),
          dematerializeInternalResult<
            ApolloQueryResult<TData>,
            TData,
            TVariables
          >(),
          filter(({ result }) => {
            const previousResult = this.subject.getValue().result;
            return (
              result.networkStatus !== NetworkStatus.ready ||
              !result.partial ||
              (!!this.options.returnPartialData &&
                previousResult.networkStatus !== NetworkStatus.error) ||
              this.options.fetchPolicy === "cache-only"
            );
          })
        ),
        fromNetwork.pipe(
          filter(filterForCurrentQuery),
          // convert errors into "errors as values"
          map(
            (
              value
            ): QueryNotification.FromNetwork<TData, TVariables> &
              QueryNotification.Meta<TData, TVariables> => {
              if (value.kind == "E") {
                const lastValue = this.subject.getValue();
                return {
                  ...value,
                  kind: "N",
                  value: {
                    data: undefined,
                    partial: true,
                    ...(isEqualQuery(lastValue, value) ? lastValue.result : {}),
                    error: value.error,
                    networkStatus: NetworkStatus.error,
                    loading: false,
                  },
                };
              }
              // else if (
              //   value.kind === "N" &&
              //   value.fetchPolicy !== "no-cache"
              // ) {
              //    TODO:
              //    the value has already been written to the cache at this point
              //    it might be a good idea to read the value from the cache
              //    instead of using the value from the network here
              // }
              return value;
            }
          ),
          dematerializeInternalResult()
        ),
        fromNetworkStatus.pipe(
          dematerializeInternalResult(),
          map((value) => {
            const previousResult = this.subject.getValue();
            const baseResult =
              isEqualQuery(previousResult, value) ?
                previousResult.result
              : this.getInitialResult();
            return {
              query: value.query,
              variables: value.variables,
              result: {
                ...baseResult,
                error: undefined,
                networkStatus: value.result.networkStatus,
              },
            };
          })
        )
      ).pipe(
        // normalize result shape
        map(({ query, variables, result }) => {
          if ("error" in result && !result.error) delete result.error;
          result.networkStatus = this.caclulateNetworkStatus(
            result.networkStatus
          );
          result.loading = isNetworkRequestInFlight(result.networkStatus);
          return { query, variables, result: this.maskResult(result) };
        }),
        tap({
          next: (value) => {
            if (value.result.error) {
              this.lastError = {
                error: value.result.error,
                query: value.query,
                variables: value.variables,
              };
            }
          },
        })
      )
    ).pipe(
      tap(({ query, ...outgoing }) => console.dir({ outgoing }, { depth: 5 }))
    );
  });

  // Reobserve with fetchPolicy effectively set to "network-only" (or keeping "no-cache")
  // to get new data from the network, becaus the cache is currently missing data.
  private reobserveFromNetwork() {
    const { fetchPolicy, nextFetchPolicy } = this.options;

    if (fetchPolicy !== "no-cache" && fetchPolicy !== "network-only") {
      return this.reobserve({
        fetchPolicy: "network-only",
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

  private getVariablesWithDefaults(variables: TVariables | undefined) {
    return this.queryManager.getVariables(this.query, variables);
  }
}

export function logMissingFieldErrors(
  missing: MissingFieldError | MissingTree | undefined
) {
  if (__DEV__ && missing) {
    invariant.debug(`Missing cache result fields: %o`, missing);
  }
}

// @ts-ignore not used right now, might come in handy again
function skipCacheDataFor(
  fetchPolicy?: WatchQueryFetchPolicy /* `undefined` would mean `"cache-first"` */
) {
  return (
    fetchPolicy === "network-only" ||
    fetchPolicy === "no-cache" ||
    fetchPolicy === "standby"
  );
}

function dematerializeInternalResult<T, TData, TVariables>(): OperatorFunction<
  ObservableNotification<T> & QueryNotification.Meta<TData, TVariables>,
  QueryNotification.InternalResult<T, TData, TVariables>
> {
  return (source) =>
    source.pipe(
      // don't dematerialize "completed" notifications
      // we don't want to accidentally close these streams
      filter((value) => value.kind !== "C"),
      map(
        (
          value: ObservableNotification<T> &
            QueryNotification.Meta<TData, TVariables>
        ): ObservableNotification<
          QueryNotification.InternalResult<T, TData, TVariables>
        > => {
          if (value.kind !== "N") {
            return value;
          }
          return {
            ...value,
            value: {
              result: value.value as T,
              query: value.query,
              variables: value.variables,
            },
          };
        }
      ),
      dematerialize()
    );
}
