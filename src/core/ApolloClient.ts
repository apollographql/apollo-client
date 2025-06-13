import type { FormattedExecutionResult } from "graphql";
import { OperationTypeNode } from "graphql";
import type { Observable } from "rxjs";
import { map } from "rxjs";

import type { ApolloCache, DataProxy, Reference } from "@apollo/client/cache";
import type {
  WatchFragmentOptions,
  WatchFragmentResult,
} from "@apollo/client/cache";
import type { ApolloLink, GraphQLRequest } from "@apollo/client/link";
import { execute } from "@apollo/client/link";
import type { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import type { LocalState } from "@apollo/client/local-state";
import type { MaybeMasked, Unmasked } from "@apollo/client/masking";
import type { DocumentTransform } from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  checkDocument,
  compact,
  getApolloClientMemoryInternals,
  mergeOptions,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { version } from "../version.js";

import type { ObservableQuery } from "./ObservableQuery.js";
import { QueryManager } from "./QueryManager.js";
import type {
  DefaultContext,
  InternalRefetchQueriesResult,
  MutateResult,
  OperationVariables,
  QueryResult,
  RefetchQueriesInclude,
  RefetchQueriesOptions,
  RefetchQueriesResult,
  SubscribeResult,
  SubscriptionObservable,
} from "./types.js";
import type {
  ErrorPolicy,
  MutationFetchPolicy,
  MutationOptions,
  QueryOptions,
  SubscriptionOptions,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "./watchQueryOptions.js";

export interface DefaultOptions {
  watchQuery?: Partial<WatchQueryOptions<any, any>>;
  query?: Partial<QueryOptions<any, any>>;
  mutate?: Partial<MutationOptions<any, any, any>>;
}

interface DevtoolsOptions {
  /**
   * If `true`, the [Apollo Client Devtools](https://www.apollographql.com/docs/react/development-testing/developer-tooling/#apollo-client-devtools) browser extension can connect to this `ApolloClient` instance.
   *
   * The default value is `false` in production and `true` in development if there is a `window` object.
   */
  enabled?: boolean;

  /**
   * Optional name for this `ApolloClient` instance in the devtools. This is
   * useful when you instantiate multiple clients and want to be able to
   * identify them by name.
   */
  name?: string;
}

let hasSuggestedDevtools = false;

export interface ApolloClientOptions {
  /**
   * You can provide an `ApolloLink` instance to serve as Apollo Client's network layer. For more information, see [Advanced HTTP networking](https://www.apollographql.com/docs/react/networking/advanced-http-networking/).
   *
   * One of `uri` or `link` is **required**. If you provide both, `link` takes precedence.
   */
  link: ApolloLink;
  /**
   * The cache that Apollo Client should use to store query results locally. The recommended cache is `InMemoryCache`, which is provided by the `@apollo/client` package.
   *
   * For more information, see [Configuring the cache](https://www.apollographql.com/docs/react/caching/cache-configuration/).
   */
  cache: ApolloCache;
  /**
   * The time interval (in milliseconds) before Apollo Client force-fetches queries after a server-side render.
   *
   * @defaultValue `0` (no delay)
   */
  ssrForceFetchDelay?: number;
  /**
   * When using Apollo Client for [server-side rendering](https://www.apollographql.com/docs/react/performance/server-side-rendering/), set this to `true` so that the [`getDataFromTree` function](../react/ssr/#getdatafromtree) can work effectively.
   *
   * @defaultValue `false`
   */
  ssrMode?: boolean;
  /**
   * If `true`, the [Apollo Client Devtools](https://www.apollographql.com/docs/react/development-testing/developer-tooling/#apollo-client-devtools) browser extension can connect to Apollo Client.
   *
   * The default value is `false` in production and `true` in development (if there is a `window` object).
   * @deprecated Please use the `devtools.enabled` option.
   */
  connectToDevTools?: boolean;
  /**
   * If `false`, Apollo Client sends every created query to the server, even if a _completely_ identical query (identical in terms of query string, variable values, and operationName) is already in flight.
   *
   * @defaultValue `true`
   */
  queryDeduplication?: boolean;
  /**
   * Provide this object to set application-wide default values for options you can provide to the `watchQuery`, `query`, and `mutate` functions. See below for an example object.
   *
   * See this [example object](https://www.apollographql.com/docs/react/api/core/ApolloClient#example-defaultoptions-object).
   */
  defaultOptions?: DefaultOptions;
  defaultContext?: Partial<DefaultContext>;
  /**
   * If `true`, Apollo Client will assume results read from the cache are never mutated by application code, which enables substantial performance optimizations.
   *
   * @defaultValue `false`
   */
  assumeImmutableResults?: boolean;
  localState?: LocalState;
  /** {@inheritDoc @apollo/client!ClientAwarenessLink.ClientAwarenessOptions:interface} */
  clientAwareness?: ClientAwarenessLink.ClientAwarenessOptions;
  /** {@inheritDoc @apollo/client!ClientAwarenessLink.EnhancedClientAwarenessOptions:interface} */
  enhancedClientAwareness?: ClientAwarenessLink.EnhancedClientAwarenessOptions;
  documentTransform?: DocumentTransform;

  /**
   * Configuration used by the [Apollo Client Devtools extension](https://www.apollographql.com/docs/react/development-testing/developer-tooling/#apollo-client-devtools) for this client.
   *
   * @since 3.11.0
   */
  devtools?: DevtoolsOptions;

  /**
   * Determines if data masking is enabled for the client.
   *
   * @defaultValue false
   */
  dataMasking?: boolean;
}

/**
 * This is the primary Apollo Client class. It is used to send GraphQL documents (i.e. queries
 * and mutations) to a GraphQL spec-compliant server over an `ApolloLink` instance,
 * receive results from the server and cache the results in a store. It also delivers updates
 * to GraphQL queries through `Observable` instances.
 */
export class ApolloClient implements DataProxy {
  public link: ApolloLink;
  public cache: ApolloCache;
  /**
   * @deprecated `disableNetworkFetches` has been renamed to `prioritizeCacheValues`.
   */
  public disableNetworkFetches!: never;

  public set prioritizeCacheValues(value: boolean) {
    this.queryManager.prioritizeCacheValues = value;
  }

  /**
   * Whether to prioritize cache values over network results when `query` or `watchQuery` is called.
   * This will essentially turn a `"network-only"` or `"cache-and-network"` fetchPolicy into a `"cache-first"` fetchPolicy,
   * but without influencing the `fetchPolicy` of the created `ObservableQuery` long-term.
   *
   * This can e.g. be used to prioritize the cache during the first render after SSR.
   */
  public get prioritizeCacheValues() {
    return this.queryManager.prioritizeCacheValues;
  }
  public version: string;
  public queryDeduplication: boolean;
  public defaultOptions: DefaultOptions;
  public readonly devtoolsConfig: DevtoolsOptions;

  private queryManager: QueryManager;
  private devToolsHookCb?: Function;
  private resetStoreCallbacks: Array<() => Promise<any>> = [];
  private clearStoreCallbacks: Array<() => Promise<any>> = [];

  /**
   * Constructs an instance of `ApolloClient`.
   *
   * @example
   * ```js
   * import { ApolloClient, InMemoryCache } from '@apollo/client';
   *
   * const cache = new InMemoryCache();
   *
   * const client = new ApolloClient({
   *   // Provide required constructor fields
   *   cache: cache,
   *   uri: 'http://localhost:4000/',
   *
   *   // Provide some optional constructor fields
   *   name: 'react-web-client',
   *   version: '1.3',
   *   queryDeduplication: false,
   *   defaultOptions: {
   *     watchQuery: {
   *       fetchPolicy: 'cache-and-network',
   *     },
   *   },
   * });
   * ```
   */
  constructor(options: ApolloClientOptions) {
    if (__DEV__) {
      invariant(
        options.cache,
        "To initialize Apollo Client, you must specify a 'cache' property " +
          "in the options object. \n" +
          "For more information, please visit: https://go.apollo.dev/c/docs"
      );

      invariant(
        options.link,
        "To initialize Apollo Client, you must specify a 'link' property " +
          "in the options object. \n" +
          "For more information, please visit: https://go.apollo.dev/c/docs"
      );
    }

    const {
      cache,
      documentTransform,
      ssrMode = false,
      ssrForceFetchDelay = 0,
      // Expose the client instance as window.__APOLLO_CLIENT__ and call
      // onBroadcast in queryManager.broadcastQueries to enable browser
      // devtools, but disable them by default in production.
      connectToDevTools,
      queryDeduplication = true,
      defaultOptions,
      defaultContext,
      assumeImmutableResults = cache.assumeImmutableResults,
      localState,
      devtools,
      dataMasking,
      link,
    } = options;

    this.link = link;
    this.cache = cache;
    this.queryDeduplication = queryDeduplication;
    this.defaultOptions = defaultOptions || {};
    this.devtoolsConfig = {
      ...devtools,
      enabled: devtools?.enabled ?? connectToDevTools,
    };

    if (this.devtoolsConfig.enabled === undefined) {
      this.devtoolsConfig.enabled = __DEV__;
    }

    this.watchQuery = this.watchQuery.bind(this);
    this.query = this.query.bind(this);
    this.mutate = this.mutate.bind(this);
    this.watchFragment = this.watchFragment.bind(this);
    this.resetStore = this.resetStore.bind(this);
    this.reFetchObservableQueries = this.reFetchObservableQueries.bind(this);

    this.version = version;

    this.queryManager = new QueryManager({
      client: this,
      defaultOptions: this.defaultOptions,
      defaultContext,
      documentTransform,
      queryDeduplication,
      ssrMode,
      dataMasking: !!dataMasking,
      clientOptions: options,
      assumeImmutableResults,
      onBroadcast:
        this.devtoolsConfig.enabled ?
          () => {
            if (this.devToolsHookCb) {
              this.devToolsHookCb();
            }
          }
        : void 0,
      localState,
    });

    this.prioritizeCacheValues = ssrMode || ssrForceFetchDelay > 0;
    if (ssrForceFetchDelay) {
      setTimeout(() => {
        this.prioritizeCacheValues = false;
      }, ssrForceFetchDelay);
    }

    if (this.devtoolsConfig.enabled) this.connectToDevTools();
  }

  private connectToDevTools() {
    if (typeof window === "undefined") {
      return;
    }

    type DevToolsConnector = {
      push(client: ApolloClient): void;
    };
    const windowWithDevTools = window as Window & {
      [devtoolsSymbol]?: DevToolsConnector;
      __APOLLO_CLIENT__?: ApolloClient;
    };
    const devtoolsSymbol = Symbol.for("apollo.devtools");
    (windowWithDevTools[devtoolsSymbol] =
      windowWithDevTools[devtoolsSymbol] || ([] as DevToolsConnector)).push(
      this
    );
    windowWithDevTools.__APOLLO_CLIENT__ = this;

    /**
     * Suggest installing the devtools for developers who don't have them
     */
    if (!hasSuggestedDevtools && __DEV__) {
      hasSuggestedDevtools = true;
      if (
        window.document &&
        window.top === window.self &&
        /^(https?|file):$/.test(window.location.protocol)
      ) {
        setTimeout(() => {
          if (!(window as any).__APOLLO_DEVTOOLS_GLOBAL_HOOK__) {
            const nav = window.navigator;
            const ua = nav && nav.userAgent;
            let url: string | undefined;
            if (typeof ua === "string") {
              if (ua.indexOf("Chrome/") > -1) {
                url =
                  "https://chrome.google.com/webstore/detail/" +
                  "apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm";
              } else if (ua.indexOf("Firefox/") > -1) {
                url =
                  "https://addons.mozilla.org/en-US/firefox/addon/apollo-developer-tools/";
              }
            }
            if (url) {
              invariant.log(
                "Download the Apollo DevTools for a better development " +
                  "experience: %s",
                url
              );
            }
          }
        }, 10000);
      }
    }
  }

  /**
   * The `DocumentTransform` used to modify GraphQL documents before a request
   * is made. If a custom `DocumentTransform` is not provided, this will be the
   * default document transform.
   */
  get documentTransform() {
    return this.queryManager.documentTransform;
  }

  /**
   * The configured `LocalState` instance used to enable the use of `@client`
   * fields.
   */
  get localState(): LocalState | undefined {
    return this.queryManager.localState;
  }

  set localState(localState: LocalState) {
    this.queryManager.localState = localState;
  }

  /**
   * Call this method to terminate any active client processes, making it safe
   * to dispose of this `ApolloClient` instance.
   */
  public stop() {
    this.queryManager.stop();
  }

  /**
   * This watches the cache store of the query according to the options specified and
   * returns an `ObservableQuery`. We can subscribe to this `ObservableQuery` and
   * receive updated results through an observer when the cache store changes.
   *
   * Note that this method is not an implementation of GraphQL subscriptions. Rather,
   * it uses Apollo's store in order to reactively deliver updates to your query results.
   *
   * For example, suppose you call watchQuery on a GraphQL query that fetches a person's
   * first and last name and this person has a particular object identifier, provided by
   * dataIdFromObject. Later, a different query fetches that same person's
   * first and last name and the first name has now changed. Then, any observers associated
   * with the results of the first query will be updated with a new result object.
   *
   * Note that if the cache does not change, the subscriber will *not* be notified.
   *
   * See [here](https://medium.com/apollo-stack/the-concepts-of-graphql-bc68bd819be3#.3mb0cbcmc) for
   * a description of store reactivity.
   */
  public watchQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: WatchQueryOptions<TVariables, TData>
  ): ObservableQuery<TData, TVariables> {
    if (this.defaultOptions.watchQuery) {
      options = mergeOptions(
        this.defaultOptions.watchQuery as Partial<
          WatchQueryOptions<TVariables, TData>
        >,
        options
      );
    }

    return this.queryManager.watchQuery<TData, TVariables>(options);
  }

  /**
   * This resolves a single query according to the options specified and
   * returns a `Promise` which is either resolved with the resulting data
   * or rejected with an error.
   *
   * @param options - An object of type `QueryOptions` that allows us to
   * describe how this query should be treated e.g. whether it should hit the
   * server at all or just resolve from the cache, etc.
   */
  public query<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: QueryOptions<TVariables, TData>
  ): Promise<QueryResult<MaybeMasked<TData>>> {
    if (this.defaultOptions.query) {
      options = mergeOptions(this.defaultOptions.query, options);
    }

    if (__DEV__) {
      invariant(
        (options.fetchPolicy as WatchQueryFetchPolicy) !== "cache-and-network",
        "The cache-and-network fetchPolicy does not work with client.query, because " +
          "client.query can only return a single result. Please use client.watchQuery " +
          "to receive multiple results from the cache and the network, or consider " +
          "using a different fetchPolicy, such as cache-first or network-only."
      );

      invariant(
        (options.fetchPolicy as WatchQueryFetchPolicy) !== "standby",
        "The standby fetchPolicy does not work with client.query, because " +
          "standby does not fetch. Consider using a different fetchPolicy, such " +
          "as cache-first or network-only."
      );

      invariant(
        options.query,
        "query option is required. You must specify your GraphQL document " +
          "in the query option."
      );

      invariant(
        options.query.kind === "Document",
        'You must wrap the query string in a "gql" tag.'
      );

      invariant(
        !(options as any).returnPartialData,
        "returnPartialData option only supported on watchQuery."
      );

      invariant(
        !(options as any).pollInterval,
        "pollInterval option only supported on watchQuery."
      );

      invariant(
        !(options as any).notifyOnNetworkStatusChange,
        "notifyOnNetworkStatusChange option only supported on watchQuery."
      );
    }

    return this.queryManager.query<TData, TVariables>(options);
  }

  /**
   * This resolves a single mutation according to the options specified and returns a
   * Promise which is either resolved with the resulting data or rejected with an
   * error. In some cases both `data` and `errors` might be undefined, for example
   * when `errorPolicy` is set to `'ignore'`.
   *
   * It takes options as an object with the following keys and values:
   */
  public mutate<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
    TCache extends ApolloCache = ApolloCache,
  >(
    options: MutationOptions<TData, TVariables, TCache>
  ): Promise<MutateResult<MaybeMasked<TData>>> {
    const optionsWithDefaults = mergeOptions(
      compact(
        {
          fetchPolicy: "network-only" as MutationFetchPolicy,
          errorPolicy: "none" as ErrorPolicy,
        },
        this.defaultOptions.mutate
      ),
      options
    ) as MutationOptions<TData, TVariables, TCache> & {
      fetchPolicy: MutationFetchPolicy;
      errorPolicy: ErrorPolicy;
    };

    if (__DEV__) {
      invariant(
        optionsWithDefaults.mutation,
        "The `mutation` option is required. Please provide a GraphQL document in the `mutation` option."
      );

      invariant(
        optionsWithDefaults.fetchPolicy === "network-only" ||
          optionsWithDefaults.fetchPolicy === "no-cache",
        "Mutations only support 'network-only' or 'no-cache' fetch policies. The default 'network-only' behavior automatically writes mutation results to the cache. Passing 'no-cache' skips the cache write."
      );
    }

    checkDocument(optionsWithDefaults.mutation, OperationTypeNode.MUTATION);

    return this.queryManager.mutate<TData, TVariables, TCache>(
      optionsWithDefaults
    );
  }

  /**
   * This subscribes to a graphql subscription according to the options specified and returns an
   * `Observable` which either emits received data or an error.
   */
  public subscribe<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: SubscriptionOptions<TVariables, TData>
  ): SubscriptionObservable<SubscribeResult<MaybeMasked<TData>>> {
    const cause = {};

    const observable =
      this.queryManager.startGraphQLSubscription<TData>(options);

    const mapped = observable.pipe(
      map((result) => ({
        ...result,
        data: this.queryManager.maskOperation({
          document: options.query,
          data: result.data,
          fetchPolicy: options.fetchPolicy,
          cause,
        }),
      }))
    );

    return Object.assign(mapped, { restart: observable.restart });
  }

  /**
   * Tries to read some data from the store in the shape of the provided
   * GraphQL query without making a network request. This method will start at
   * the root query. To start at a specific id returned by `dataIdFromObject`
   * use `readFragment`.
   *
   * @param optimistic - Set to `true` to allow `readQuery` to return
   * optimistic results. Is `false` by default.
   */
  public readQuery<TData = unknown, TVariables = OperationVariables>(
    options: DataProxy.Query<TVariables, TData>,
    optimistic: boolean = false
  ): Unmasked<TData> | null {
    return this.cache.readQuery<TData, TVariables>(options, optimistic);
  }

  /**
   * Watches the cache store of the fragment according to the options specified
   * and returns an `Observable`. We can subscribe to this
   * `Observable` and receive updated results through an
   * observer when the cache store changes.
   *
   * You must pass in a GraphQL document with a single fragment or a document
   * with multiple fragments that represent what you are reading. If you pass
   * in a document with multiple fragments then you must also specify a
   * `fragmentName`.
   *
   * @since 3.10.0
   * @param options - An object of type `WatchFragmentOptions` that allows
   * the cache to identify the fragment and optionally specify whether to react
   * to optimistic updates.
   */

  public watchFragment<TData = unknown, TVariables = OperationVariables>(
    options: WatchFragmentOptions<TData, TVariables>
  ): Observable<WatchFragmentResult<TData>> {
    return this.cache.watchFragment({
      ...options,
      [Symbol.for("apollo.dataMasking")]: this.queryManager.dataMasking,
    });
  }

  /**
   * Tries to read some data from the store in the shape of the provided
   * GraphQL fragment without making a network request. This method will read a
   * GraphQL fragment from any arbitrary id that is currently cached, unlike
   * `readQuery` which will only read from the root query.
   *
   * You must pass in a GraphQL document with a single fragment or a document
   * with multiple fragments that represent what you are reading. If you pass
   * in a document with multiple fragments then you must also specify a
   * `fragmentName`.
   *
   * @param optimistic - Set to `true` to allow `readFragment` to return
   * optimistic results. Is `false` by default.
   */
  public readFragment<T = unknown, TVariables = OperationVariables>(
    options: DataProxy.Fragment<TVariables, T>,
    optimistic: boolean = false
  ): Unmasked<T> | null {
    return this.cache.readFragment<T, TVariables>(options, optimistic);
  }

  /**
   * Writes some data in the shape of the provided GraphQL query directly to
   * the store. This method will start at the root query. To start at a
   * specific id returned by `dataIdFromObject` then use `writeFragment`.
   */
  public writeQuery<TData = unknown, TVariables = OperationVariables>(
    options: DataProxy.WriteQueryOptions<TData, TVariables>
  ): Reference | undefined {
    const ref = this.cache.writeQuery<TData, TVariables>(options);

    if (options.broadcast !== false) {
      this.queryManager.broadcastQueries();
    }

    return ref;
  }

  /**
   * Writes some data in the shape of the provided GraphQL fragment directly to
   * the store. This method will write to a GraphQL fragment from any arbitrary
   * id that is currently cached, unlike `writeQuery` which will only write
   * from the root query.
   *
   * You must pass in a GraphQL document with a single fragment or a document
   * with multiple fragments that represent what you are writing. If you pass
   * in a document with multiple fragments then you must also specify a
   * `fragmentName`.
   */
  public writeFragment<TData = unknown, TVariables = OperationVariables>(
    options: DataProxy.WriteFragmentOptions<TData, TVariables>
  ): Reference | undefined {
    const ref = this.cache.writeFragment<TData, TVariables>(options);

    if (options.broadcast !== false) {
      this.queryManager.broadcastQueries();
    }

    return ref;
  }

  public __actionHookForDevTools(cb: () => any) {
    this.devToolsHookCb = cb;
  }

  public __requestRaw(
    payload: GraphQLRequest
  ): Observable<FormattedExecutionResult> {
    return execute(this.link, payload, { client: this });
  }

  /**
   * Resets your entire store by clearing out your cache and then re-executing
   * all of your active queries. This makes it so that you may guarantee that
   * there is no data left in your store from a time before you called this
   * method.
   *
   * `resetStore()` is useful when your user just logged out. You’ve removed the
   * user session, and you now want to make sure that any references to data you
   * might have fetched while the user session was active is gone.
   *
   * It is important to remember that `resetStore()` *will* refetch any active
   * queries. This means that any components that might be mounted will execute
   * their queries again using your network interface. If you do not want to
   * re-execute any queries then you should make sure to stop watching any
   * active queries.
   */
  public resetStore(): Promise<QueryResult<any>[] | null> {
    return Promise.resolve()
      .then(() =>
        this.queryManager.clearStore({
          discardWatches: false,
        })
      )
      .then(() => Promise.all(this.resetStoreCallbacks.map((fn) => fn())))
      .then(() => this.reFetchObservableQueries());
  }

  /**
   * Remove all data from the store. Unlike `resetStore`, `clearStore` will
   * not refetch any active queries.
   */
  public clearStore(): Promise<any[]> {
    return Promise.resolve()
      .then(() =>
        this.queryManager.clearStore({
          discardWatches: true,
        })
      )
      .then(() => Promise.all(this.clearStoreCallbacks.map((fn) => fn())));
  }

  /**
   * Allows callbacks to be registered that are executed when the store is
   * reset. `onResetStore` returns an unsubscribe function that can be used
   * to remove registered callbacks.
   */
  public onResetStore(cb: () => Promise<any>): () => void {
    this.resetStoreCallbacks.push(cb);
    return () => {
      this.resetStoreCallbacks = this.resetStoreCallbacks.filter(
        (c) => c !== cb
      );
    };
  }

  /**
   * Allows callbacks to be registered that are executed when the store is
   * cleared. `onClearStore` returns an unsubscribe function that can be used
   * to remove registered callbacks.
   */
  public onClearStore(cb: () => Promise<any>): () => void {
    this.clearStoreCallbacks.push(cb);
    return () => {
      this.clearStoreCallbacks = this.clearStoreCallbacks.filter(
        (c) => c !== cb
      );
    };
  }

  /**
   * Refetches all of your active queries.
   *
   * `reFetchObservableQueries()` is useful if you want to bring the client back to proper state in case of a network outage
   *
   * It is important to remember that `reFetchObservableQueries()` *will* refetch any active
   * queries. This means that any components that might be mounted will execute
   * their queries again using your network interface. If you do not want to
   * re-execute any queries then you should make sure to stop watching any
   * active queries.
   * Takes optional parameter `includeStandby` which will include queries in standby-mode when refetching.
   */
  public reFetchObservableQueries(
    includeStandby?: boolean
  ): Promise<QueryResult<any>[]> {
    return this.queryManager.refetchObservableQueries(includeStandby);
  }

  /**
   * Refetches specified active queries. Similar to "reFetchObservableQueries()" but with a specific list of queries.
   *
   * `refetchQueries()` is useful for use cases to imperatively refresh a selection of queries.
   *
   * It is important to remember that `refetchQueries()` *will* refetch specified active
   * queries. This means that any components that might be mounted will execute
   * their queries again using your network interface. If you do not want to
   * re-execute any queries then you should make sure to stop watching any
   * active queries.
   */
  public refetchQueries<
    TCache extends ApolloCache = ApolloCache,
    TResult = Promise<QueryResult<any>>,
  >(
    options: RefetchQueriesOptions<TCache, TResult>
  ): RefetchQueriesResult<TResult> {
    const map = this.queryManager.refetchQueries(
      options as RefetchQueriesOptions<ApolloCache, TResult>
    );
    const queries: ObservableQuery<any>[] = [];
    const results: InternalRefetchQueriesResult<TResult>[] = [];

    map.forEach((result, obsQuery) => {
      queries.push(obsQuery);
      results.push(result);
    });

    const result = Promise.all<TResult>(
      results as TResult[]
    ) as RefetchQueriesResult<TResult>;

    // In case you need the raw results immediately, without awaiting
    // Promise.all(results):
    result.queries = queries;
    result.results = results;

    // If you decide to ignore the result Promise because you're using
    // result.queries and result.results instead, you shouldn't have to worry
    // about preventing uncaught rejections for the Promise.all result.
    result.catch((error) => {
      invariant.debug(
        `In client.refetchQueries, Promise.all promise rejected with error %o`,
        error
      );
    });

    return result;
  }

  /**
   * Get all currently active `ObservableQuery` objects, in a `Map` keyed by
   * query ID strings.
   *
   * An "active" query is one that has observers and a `fetchPolicy` other than
   * "standby" or "cache-only".
   *
   * You can include all `ObservableQuery` objects (including the inactive ones)
   * by passing "all" instead of "active", or you can include just a subset of
   * active queries by passing an array of query names or DocumentNode objects.
   */
  public getObservableQueries(
    include: RefetchQueriesInclude = "active"
  ): Set<ObservableQuery<any>> {
    return this.queryManager.getObservableQueries(include);
  }

  /**
   * Exposes the cache's complete state, in a serializable format for later restoration.
   */
  public extract(optimistic?: boolean) {
    return this.cache.extract(optimistic);
  }

  /**
   * Replaces existing state in the cache (if any) with the values expressed by
   * `serializedState`.
   *
   * Called when hydrating a cache (server side rendering, or offline storage),
   * and also (potentially) during hot reloads.
   */
  public restore(serializedState: unknown) {
    return this.cache.restore(serializedState);
  }

  /**
   * Define a new ApolloLink (or link chain) that Apollo Client will use.
   */
  public setLink(newLink: ApolloLink) {
    this.link = newLink;
  }

  public get defaultContext() {
    return this.queryManager.defaultContext;
  }

  /**
   * @experimental
   * This is not a stable API - it is used in development builds to expose
   * information to the DevTools.
   * Use at your own risk!
   * For more details, see [Memory Management](https://www.apollographql.com/docs/react/caching/memory-management/#measuring-cache-usage)
   *
   * @example
   * ```ts
   * console.log(client.getMemoryInternals())
   * ```
   * Logs output in the following JSON format:
   * @example
   * ```json
   *{
   *  limits:     {
   *    canonicalStringify: 1000,
   *    print: 2000,
   *    'documentTransform.cache': 2000,
   *    'queryManager.getDocumentInfo': 2000,
   *    'PersistedQueryLink.persistedQueryHashes': 2000,
   *    'fragmentRegistry.transform': 2000,
   *    'fragmentRegistry.lookup': 1000,
   *    'fragmentRegistry.findFragmentSpreads': 4000,
   *    'cache.fragmentQueryDocuments': 1000,
   *    'removeTypenameFromVariables.getVariableDefinitions': 2000,
   *    'inMemoryCache.maybeBroadcastWatch': 5000,
   *    'inMemoryCache.executeSelectionSet': 10000,
   *    'inMemoryCache.executeSubSelectedArray': 5000
   *  },
   *  sizes: {
   *    canonicalStringify: 4,
   *    print: 14,
   *    addTypenameDocumentTransform: [
   *      {
   *        cache: 14,
   *      },
   *    ],
   *    queryManager: {
   *      getDocumentInfo: 14,
   *      documentTransforms: [
   *        {
   *          cache: 14,
   *        },
   *        {
   *          cache: 14,
   *        },
   *      ],
   *    },
   *    fragmentRegistry: {
   *      findFragmentSpreads: 34,
   *      lookup: 20,
   *      transform: 14,
   *    },
   *    cache: {
   *      fragmentQueryDocuments: 22,
   *    },
   *    inMemoryCache: {
   *      executeSelectionSet: 4345,
   *      executeSubSelectedArray: 1206,
   *      maybeBroadcastWatch: 32,
   *    },
   *    links: [
   *      {
   *        PersistedQueryLink: {
   *          persistedQueryHashes: 14,
   *        },
   *      },
   *      {
   *        removeTypenameFromVariables: {
   *          getVariableDefinitions: 14,
   *        },
   *      },
   *    ],
   *  },
   * }
   *```
   */
  public getMemoryInternals?: typeof getApolloClientMemoryInternals;
}

if (__DEV__) {
  ApolloClient.prototype.getMemoryInternals = getApolloClientMemoryInternals;
}
