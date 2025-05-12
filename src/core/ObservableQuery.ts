import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";
import { Slot } from "optimism";
import type {
  InteropObservable,
  Observer,
  OperatorFunction,
  Subscribable,
  Subscription,
} from "rxjs";
import { Observable } from "rxjs";
import { lastValueFrom, Subject, tap } from "rxjs";

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
import {
  filterMap,
  SlotAwareBehaviorSubject,
  toQueryResult,
} from "@apollo/client/utilities/internal";
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
const uninitialized: ApolloQueryResult<any> = {
  loading: true,
  networkStatus: NetworkStatus.loading,
  data: undefined,
  partial: true,
};

const empty: ApolloQueryResult<any> = {
  loading: false,
  networkStatus: NetworkStatus.ready,
  data: undefined,
  partial: true,
};

interface Meta {
  readonly query: DocumentNode;
  readonly variables: OperationVariables | undefined;
  shouldEmit?: boolean | "notification";
  /** can be used to override `ObservableQuery.options.fetchPolicy` for this notification */
  fetchPolicy?: WatchQueryFetchPolicy;
}
const queryMetaSlot = new Slot<Meta>();

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

  private unsubscribeFromCache?: () => void;
  private input: Subject<QueryNotification.Value<TData, TVariables>>;
  private subject: SlotAwareBehaviorSubject<
    ApolloQueryResult<MaybeMasked<TData>>,
    Meta
  >;
  private readonly observable: Observable<
    ApolloQueryResult<MaybeMasked<TData>>
  >;

  private isTornDown: boolean;
  private queryManager: QueryManager;
  private subscriptions = new Set<Subscription>();

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
    return this.subject.getValue().networkStatus;
  }

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

    this.subject = new SlotAwareBehaviorSubject<
      ApolloQueryResult<MaybeMasked<TData>>,
      Meta
    >(uninitialized, queryMetaSlot, {
      query: this.query,
      variables: this.variables,
    });
    this.observable = this.subject.pipe(
      tap({
        subscribe: () => {
          if (startedInactive) {
            queryManager["queries"].set(this.queryId, queryInfo);
            startedInactive = false;
          }
          if (!this.subject.observed) {
            if (this.options.fetchPolicy === "standby") {
              // this could probably move into `reobserve` in some way

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
              const value = this.getInitialResult({ observed: true });

              () =>
                queryMetaSlot.withValue(
                  {
                    query: this.query,
                    variables: this.variables,
                    shouldEmit: value.loading ? "notification" : true,
                  },
                  () => this.subject.next(value)
                );
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
      filterMap(
        (
          current: ApolloQueryResult<TData>,
          context: {
            previous?: ApolloQueryResult<TData>;
            previousVariables?: TVariables;
          }
        ) => {
          const { query, variables, shouldEmit } = queryMetaSlot.getValue()!;

          if (current === uninitialized) {
            // reset internal state after `ObservableQuery.reset()`
            context.previous = undefined;
            context.previousVariables = undefined;
          }
          if (this.options.fetchPolicy === "standby") return;
          if (shouldEmit === true) return emit();
          if (shouldEmit === false) return;

          const { previous, previousVariables } = context;

          if (previous) {
            const documentInfo = this.queryManager.getDocumentInfo(query);
            const dataMasking = this.queryManager.dataMasking;
            const maskedQuery =
              dataMasking ? documentInfo.nonReactiveQuery : query;

            const resultIsEqual =
              dataMasking || documentInfo.hasNonreactiveDirective ?
                equalByQuery(maskedQuery, previous, current, variables)
              : equal(previous, current);

            if (
              resultIsEqual &&
              (!variables || equal(previousVariables, variables))
            ) {
              return;
            }
          }

          if (
            shouldEmit === "notification" &&
            (!this.options.notifyOnNetworkStatusChange ||
              equal(previous, current))
          ) {
            return;
          }
          return emit();

          function emit() {
            context.previous = current;
            context.previousVariables = variables as TVariables;
            return current;
          }
        },
        () => ({})
      )
      // tap((value) => console.log({ emitted: value }))
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
      : queryMetaSlot.getValue()?.fetchPolicy || this.options.fetchPolicy;
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

    this.unsubscribeFromCache?.();

    if (fetchPolicy === "standby" || fetchPolicy === "no-cache") {
      return;
    }

    this.unsubscribeFromCache = this.queryManager.cache.watch({
      query,
      variables,
      optimistic: true,
      watcher: this,
      callback: (diff) => {
        const previousResult = this.subject.getValue();

        if (
          diff &&
          !diff.complete &&
          // If we are trying to deliver an incomplete cache result, we avoid
          // reporting it if the query has errored, otherwise we let the broadcast try
          // and repair the partial result by refetching the query. This check avoids
          // a situation where a query that errors and another succeeds with
          // overlapping data does not report the partial data result to the errored
          // query.
          //
          // See https://github.com/apollographql/apollo-client/issues/11400 for more
          // information on this issue.
          (previousResult.error ||
            // we also want to prevent to schedule reads directly after the `ObservableQuery`
            // has been `reset` (which will set the `previousResult` to `uninitialized` or `empty`)
            // as in those cases, `resetCache` will manually call `refetch` more intentional timing.
            previousResult === uninitialized ||
            previousResult === empty)
        ) {
          return;
        }

        if (!equal(previousResult.data, diff && diff.result)) {
          this.scheduleNotify();
        }
      },
    });
  }

  private stableLastResult?: ApolloQueryResult<MaybeMasked<TData>>;
  public getCurrentResult(): ApolloQueryResult<MaybeMasked<TData>> {
    let value =
      (
        // if we have no observers, and the fetch policy is no-cache,
        //  this.subject.getValue() could potentially be outdated,
        // so we recalculate the result
        !this.hasObservers() &&
        // unless we are using a `no-cache` fetch policy in which case this
        // `ObservableQuery` cannot have been updated from the outside - in
        // that case, we prefer to keep the current value
        this.options.fetchPolicy === "no-cache"
      ) ?
        this.getInitialResult()
      : this.subject.getValue();

    if (value === uninitialized) {
      value = this.getInitialResult();
    }
    if (!equal(this.stableLastResult, value)) {
      this.stableLastResult = value;
    }
    return this.stableLastResult!;
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

    let wasUpdated = false;

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
    pushNotification(
      {
        source: "newNetworkStatus",
        kind: "N",
        value: {},
      },
      { shouldEmit: "notification" }
    );
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
              if (watch.watcher === this) {
                wasUpdated = true;
              }
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
              networkStatus: NetworkStatus.ready,
              // will be overwritten anyways, just here for types sake
              loading: false,
              data: data as TData,
            },
            source: "network",
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
        if (isCached && !wasUpdated) {
          pushNotification(
            {
              kind: "N",
              source: "newNetworkStatus",
              value: {},
            },
            { shouldEmit: true }
          );
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
      return toQueryResult(this.subject.getValue());
    }

    this.options.variables = variables;

    // See comment above
    if (!this.hasObservers()) {
      // shouldn't this be `getCurrentResult` or this might be outdated?
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
    networkStatus: NetworkStatus,
    fetchQuery?: DocumentNode
  ) {
    // TODO Make sure we update the networkStatus (and infer fetchVariables)
    // before actually committing to the fetch.
    const initialFetchPolicy = this.options.fetchPolicy;
    const queryInfo = this.queryManager.getOrCreateQuery(this.queryId);
    queryInfo.setObservableQuery(this);
    const { observable, fromLink } = this.queryManager.fetchObservableWithInfo(
      queryInfo,
      options,
      networkStatus,
      fetchQuery,
      (forward) => {
        // If the operation synchronously emits a value, that will already have set
        // some kind of loading state. Otherwise, we will emit a `newNetworkStatus`
        // event once the subscription is set up.
        // This has to happen in a "middleware wrapper" around `fetchQuery` call,
        // since our definition of "synchronously" should start only after
        // @exports variables have resolved.
        const result = forward();
        result.observable = result.observable.pipe(
          // we cannot use `tap` here, since it allows only for a "before subscription"
          // hook with `subscribe` and we care for "directly before and after subscription"
          (source) =>
            new Observable<QueryNotification.Value<TData, any>>(
              (subscriber) => {
                let synchronouslyEmitted = false;
                try {
                  return source.subscribe({
                    next(value) {
                      synchronouslyEmitted = true;
                      subscriber.next(value);
                    },
                    error: (error) => subscriber.error(error),
                    complete: () => subscriber.complete(),
                  });
                } finally {
                  if (
                    !synchronouslyEmitted &&
                    this.activeOperations.has(operation)
                  ) {
                    operation.override = networkStatus;
                    queryMetaSlot.withValue(
                      {
                        variables,
                        query,
                        shouldEmit: "notification",
                        /*
                         * The moment this notification is emitted, `nextFetchPolicy`
                         * might already have switched from a `network-only` to a
                         * `cache-something` policy, so we want to ensure that the
                         * loading state emit doesn't accidentally read from the cache
                         * in those cases.
                         */
                        fetchPolicy: initialFetchPolicy,
                      },
                      () =>
                        this.input.next({
                          kind: "N",
                          source: "newNetworkStatus",
                          value: {
                            resetError: true,
                          },
                        })
                    );
                  }
                }
              }
            )
        );
        return result;
      }
    );

    // track query and variables from the start of the operation
    const { query, variables } = this;
    const operation: TrackedOperation = {
      networkStatus,
      abort: () => subscription.unsubscribe(),
      query,
      variables,
    };
    this.activeOperations.add(operation);

    let forceFirstValueEmit =
      networkStatus == NetworkStatus.refetch ||
      networkStatus == NetworkStatus.setVariables;
    const subscription = observable
      .pipe(
        tap({
          next: (notification) => {
            if (
              notification.source === "newNetworkStatus" ||
              (notification.kind === "N" && notification.value.loading)
            ) {
              operation.override = networkStatus;
            } else {
              delete operation.override;
            }
          },
          finalize: () => this.activeOperations.delete(operation),
        })
      )
      .subscribe({
        next: (value) => {
          const meta: Meta = { variables, query };

          if (
            forceFirstValueEmit &&
            value.kind === "N" &&
            "loading" in value.value &&
            !value.value.loading
          ) {
            forceFirstValueEmit = false;
            meta.shouldEmit = true;
          }

          queryMetaSlot.withValue(meta, () => this.input.next(value));
        },
        error: (err) => this.input.error(err),
        complete: () => this.input.complete(),
      });

    return { fromLink, subscription, observable };
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

  /**
   * Reevaluate the query, optionally against new options. New options will be
   * merged with the current options when given.
   */
  public reobserve(
    newOptions?: Partial<ObservableQuery.Options<TData, TVariables>>
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
        options.fetchPolicy !== "standby" &&
        // If we're changing the fetchPolicy anyway, don't try to change it here
        // using applyNextFetchPolicy. The explicit options.fetchPolicy wins.
        (options.fetchPolicy === oldFetchPolicy ||
          // A `nextFetchPolicy` function has even higher priority, though,
          // so in that case `applyNextFetchPolicy` must be called.
          typeof options.nextFetchPolicy === "function")
      ) {
        // This might mutate options.fetchPolicy
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
      if (options.fetchPolicy === "standby") {
        newNetworkStatus = NetworkStatus.ready;
      }
    }

    if (options.fetchPolicy === "standby") {
      this.cancelPolling();
    }
    if (
      !useDisposableObservable ||
      // TODO: investigate - should `refetch` actually be a disposable Query?
      newNetworkStatus === NetworkStatus.refetch
    ) {
      this.resubscribeCache();
    }

    const { subscription, observable, fromLink } = this.fetch(
      options,
      newNetworkStatus,
      query
    );

    if (!useDisposableObservable && (fromLink || !this.linkSubscription)) {
      if (this.linkSubscription) {
        this.linkSubscription.unsubscribe();
      }

      this.linkSubscription = subscription;
    }

    return preventUnhandledRejection(
      // Note: lastValueFrom will create a separate subscription to the
      // observable which means that terminating this ObservableQuery will not
      // cancel the request from the link chain.
      lastValueFrom(
        observable.pipe(
          filterMap((value) => {
            switch (value.kind) {
              case "E":
                throw value.error;
              case "N":
                if (value.source !== "newNetworkStatus") return value.value;
            }
          })
        ),
        {
          // This default value should only be used when using a `fetchPolicy` of
          // `standby` since that fetch policy completes without emitting a
          // result. Since we are converting this to a QueryResult type, we
          // omit the extra fields from ApolloQueryResult in the default value.
          defaultValue: { data: undefined } as ApolloQueryResult<TData>,
        }
      ).then((result) => toQueryResult(this.maskResult(result)))
    );
  }

  public hasObservers() {
    return this.subject.observed;
  }

  private tearDownQuery() {
    if (this.isTornDown) return;

    this.resetNotifications();
    this.unsubscribeFromCache?.();
    if (this.linkSubscription) {
      this.linkSubscription.unsubscribe();
      delete this.linkSubscription;
    }

    this.stopPolling();
    // stop all active GraphQL subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.queryManager.removeQuery(this.queryId);
    this.isTornDown = true;
    this.abortActiveOperations();
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
        this.options.fetchPolicy == "cache-only" ||
        this.options.fetchPolicy == "cache-and-network" ||
        !this.activeOperations.size
      ) {
        const diff = this.getCacheDiff();
        if (
          // `fromOptimisticTransaction` is not avaiable through the `cache.diff`
          // code path, so we need to check it this way
          !equal(diff.result, this.getCacheDiff({ optimistic: false }).result)
        ) {
          // If this diff came from an optimistic transaction, deliver the
          // current cache data to the ObservableQuery, but don't perform a
          // reobservation, since oq.reobserveCacheFirst might make a network
          // request, and we never want to trigger network requests in the
          // middle of optimistic updates.
          // if (diff.result) {
          queryMetaSlot.withValue(
            // maybe from diff?
            { query: this.query, variables: this.variables },
            () =>
              this.input.next({
                kind: "N",
                value: {
                  data: diff.result as TData,
                  networkStatus: NetworkStatus.ready,
                  loading: false,
                  error: undefined,
                  partial: !diff.complete,
                },
                source: "cache",
              })
          );
          // }
        } else {
          // Otherwise, make the ObservableQuery "reobserve" the latest data
          // using a temporary fetch policy of "cache-first", so complete cache
          // results have a chance to be delivered without triggering additional
          // network requests, even when options.fetchPolicy is "network-only"
          // or "cache-and-network". All other fetch policies are preserved by
          // this method, and are handled by calling oq.reobserve(). If this
          // reobservation is spurious, distinctUntilChanged still has a
          // chance to catch it before delivery to ObservableQuery subscribers.
          this.reobserveCacheFirst();
        }
      }
    }
  }

  private activeOperations = new Set<TrackedOperation>();
  private pushOperation(networkStatus: NetworkStatus): {
    finalize: () => void;
    pushNotification: (
      notification: QueryNotification.Value<TData, TVariables>,
      additionalMeta?: Omit<Meta, "query" | "variables">
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
        notification: QueryNotification.Value<TData, TVariables>,
        additionalMeta?: Omit<Meta, "query" | "variables">
      ) => {
        if (!aborted) {
          queryMetaSlot.withValue({ query, variables, ...additionalMeta }, () =>
            this.input.next({
              ...notification,
            } as QueryNotification.Value<TData, TVariables>)
          );
        }
      },
    };
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
      (operation) =>
        /* TODO: should ensure that on variable change, active operations are reliably cleaned up */
        isEqualQuery(operation, this) && operation.override !== undefined
    );
    return operation?.override ?? baseNetworkStatus;
  }

  private abortActiveOperations() {
    this.activeOperations.forEach((operation) => operation.abort());
  }

  /**
   * @internal
   * Called from `clearStore`.
   * * resets the query to its initial state
   * * cancels all active operations and their subscriptions
   */
  public reset() {
    // exception for cache-only queries - we reset them into a "ready" state
    // as we won't trigger a refetch for them
    const resetToEmpty = this.options.fetchPolicy === "cache-only";
    this.setResult(resetToEmpty ? empty : uninitialized, {
      shouldEmit: resetToEmpty,
    });

    this.lastError = undefined;

    this.abortActiveOperations();
  }

  /** @internal */
  public setResult(
    result: ApolloQueryResult<TData>,
    additionalMeta?: Omit<Meta, "query" | "variables">
  ) {
    queryMetaSlot.withValue(
      { query: this.query, variables: this.variables, ...additionalMeta },
      () =>
        this.input.next({
          source: "setResult",
          kind: "N",
          value: result,
        })
    );
  }

  private operator: OperatorFunction<
    QueryNotification.Value<TData, TVariables>,
    ApolloQueryResult<TData>
  > = filterMap<
    QueryNotification.Value<TData, TVariables>,
    ApolloQueryResult<TData>
  >((notification) => {
    if (notification.source === "setResult") {
      return notification.value;
    }
    const meta = queryMetaSlot.getValue();
    invariant(meta);

    if (notification.kind === "C" || !isEqualQuery(meta, this)) {
      return;
    }

    let result: ApolloQueryResult<TData>;
    const previousResult = this.subject.getValue();
    const previousMeta = this.subject.getSlotValue();

    if (notification.source === "cache") {
      result = notification.value;
      if (
        !(
          result.networkStatus !== NetworkStatus.ready ||
          !result.partial ||
          (!!this.options.returnPartialData &&
            previousResult.networkStatus !== NetworkStatus.error) ||
          this.options.fetchPolicy === "cache-only"
        )
      ) {
        return;
      }
    } else if (notification.source === "network") {
      result =
        notification.kind === "E" ?
          {
            data: undefined,
            partial: true,
            ...(isEqualQuery(previousMeta, meta) ? previousResult : {}),
            error: notification.error,
            networkStatus: NetworkStatus.error,
            loading: false,
          }
        : notification.value;

      if (result.error) {
        meta.shouldEmit = true;
      }
    } else if (notification.source === "newNetworkStatus") {
      const baseResult =
        previousMeta && isEqualQuery(previousMeta, meta) ? previousResult : (
          this.getInitialResult()
        );
      const { resetError } = notification.value;
      const error = resetError ? undefined : baseResult.error;
      const networkStatus = error ? NetworkStatus.error : NetworkStatus.ready;
      result = {
        ...baseResult,
        error,
        networkStatus,
      };
    }
    // every code path until here should have either returned or set a result,
    // but typescript needs a little help
    invariant(result!);

    // normalize result shape
    if ("error" in result && !result.error) delete result.error;
    result.networkStatus = this.caclulateNetworkStatus(result.networkStatus);
    result.loading = isNetworkRequestInFlight(result.networkStatus);
    result = this.maskResult(result);

    if (result.error) {
      const { query, variables } = queryMetaSlot.getValue()!;
      this.lastError = {
        error: result.error,
        query,
        variables: variables as TVariables,
      };
    }

    return result;
  });

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

function isEqualQuery(
  a?: { query: DocumentNode; variables?: OperationVariables },
  b?: { query: DocumentNode; variables?: OperationVariables }
) {
  return !!(
    a &&
    b &&
    a.query === b.query &&
    equal(a.variables || {}, b.variables || {})
  );
}
