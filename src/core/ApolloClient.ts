import { invariant, newInvariantError } from "../utilities/globals/index.js";

import type { ExecutionResult, DocumentNode } from "graphql";

import type { FetchResult, GraphQLRequest } from "../link/core/index.js";
import { ApolloLink, execute } from "../link/core/index.js";
import type { ApolloCache, DataProxy, Reference } from "../cache/index.js";
import type { DocumentTransform, Observable } from "../utilities/index.js";
import { version } from "../version.js";
import type { UriFunction } from "../link/http/index.js";
import { HttpLink } from "../link/http/index.js";

import { QueryManager } from "./QueryManager.js";
import type { ObservableQuery } from "./ObservableQuery.js";

import type {
  ApolloQueryResult,
  DefaultContext,
  OperationVariables,
  Resolvers,
  RefetchQueriesOptions,
  RefetchQueriesResult,
  InternalRefetchQueriesResult,
  RefetchQueriesInclude,
} from "./types.js";

import type {
  QueryOptions,
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
  WatchQueryFetchPolicy,
} from "./watchQueryOptions.js";

import type { FragmentMatcher } from "./LocalState.js";
import { LocalState } from "./LocalState.js";

export interface DefaultOptions {
  watchQuery?: Partial<WatchQueryOptions<any, any>>;
  query?: Partial<QueryOptions<any, any>>;
  mutate?: Partial<MutationOptions<any, any, any>>;
}

let hasSuggestedDevtools = false;

export interface ApolloClientOptions<TCacheShape> {
  /**
   * The URI of the GraphQL endpoint that Apollo Client will communicate with.
   *
   * One of `uri` or `link` is **required**. If you provide both, `link` takes precedence.
   */
  uri?: string | UriFunction;
  credentials?: string;
  /**
   * An object representing headers to include in every HTTP request, such as `{Authorization: 'Bearer 1234'}`
   *
   * This value will be ignored when using the `link` option.
   */
  headers?: Record<string, string>;
  /**
   * You can provide an `ApolloLink` instance to serve as Apollo Client's network layer. For more information, see [Advanced HTTP networking](https://www.apollographql.com/docs/react/networking/advanced-http-networking/).
   *
   * One of `uri` or `link` is **required**. If you provide both, `link` takes precedence.
   */
  link?: ApolloLink;
  /**
   * The cache that Apollo Client should use to store query results locally. The recommended cache is `InMemoryCache`, which is provided by the `@apollo/client` package.
   *
   * For more information, see [Configuring the cache](https://www.apollographql.com/docs/react/caching/cache-configuration/).
   */
  cache: ApolloCache<TCacheShape>;
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
  resolvers?: Resolvers | Resolvers[];
  typeDefs?: string | string[] | DocumentNode | DocumentNode[];
  fragmentMatcher?: FragmentMatcher;
  /**
   * A custom name (e.g., `iOS`) that identifies this particular client among your set of clients. Apollo Server and Apollo Studio use this property as part of the [client awareness](https://www.apollographql.com/docs/apollo-server/monitoring/metrics#identifying-distinct-clients) feature.
   */
  name?: string;
  /**
   * A custom version that identifies the current version of this particular client (e.g., `1.2`). Apollo Server and Apollo Studio use this property as part of the [client awareness](https://www.apollographql.com/docs/apollo-server/monitoring/metrics#identifying-distinct-clients) feature.
   *
   * This is **not** the version of Apollo Client that you are using, but rather any version string that helps you differentiate between versions of your client.
   */
  version?: string;
  documentTransform?: DocumentTransform;
}

// Though mergeOptions now resides in @apollo/client/utilities, it was
// previously declared and exported from this module, and then reexported from
// @apollo/client/core. Since we need to preserve that API anyway, the easiest
// solution is to reexport mergeOptions where it was previously declared (here).
import { mergeOptions } from "../utilities/index.js";
import { getApolloClientMemoryInternals } from "../utilities/caching/getMemoryInternals.js";
export { mergeOptions };

/**
 * This is the primary Apollo Client class. It is used to send GraphQL documents (i.e. queries
 * and mutations) to a GraphQL spec-compliant server over an `ApolloLink` instance,
 * receive results from the server and cache the results in a store. It also delivers updates
 * to GraphQL queries through `Observable` instances.
 */
export class ApolloClient<TCacheShape> implements DataProxy {
  public link: ApolloLink;
  public cache: ApolloCache<TCacheShape>;
  public disableNetworkFetches: boolean;
  public version: string;
  public queryDeduplication: boolean;
  public defaultOptions: DefaultOptions;
  public readonly typeDefs: ApolloClientOptions<TCacheShape>["typeDefs"];

  private queryManager: QueryManager<TCacheShape>;
  private devToolsHookCb?: Function;
  private resetStoreCallbacks: Array<() => Promise<any>> = [];
  private clearStoreCallbacks: Array<() => Promise<any>> = [];
  private localState: LocalState<TCacheShape>;

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
  constructor(options: ApolloClientOptions<TCacheShape>) {
    if (!options.cache) {
      throw newInvariantError(
        "To initialize Apollo Client, you must specify a 'cache' property " +
          "in the options object. \n" +
          "For more information, please visit: https://go.apollo.dev/c/docs"
      );
    }

    const {
      uri,
      credentials,
      headers,
      cache,
      documentTransform,
      ssrMode = false,
      ssrForceFetchDelay = 0,
      // Expose the client instance as window.__APOLLO_CLIENT__ and call
      // onBroadcast in queryManager.broadcastQueries to enable browser
      // devtools, but disable them by default in production.
      connectToDevTools = typeof window === "object" &&
        !(window as any).__APOLLO_CLIENT__ &&
        __DEV__,
      queryDeduplication = true,
      defaultOptions,
      defaultContext,
      assumeImmutableResults = cache.assumeImmutableResults,
      resolvers,
      typeDefs,
      fragmentMatcher,
      name: clientAwarenessName,
      version: clientAwarenessVersion,
    } = options;

    let { link } = options;

    if (!link) {
      link =
        uri ? new HttpLink({ uri, credentials, headers }) : ApolloLink.empty();
    }

    this.link = link;
    this.cache = cache;
    this.disableNetworkFetches = ssrMode || ssrForceFetchDelay > 0;
    this.queryDeduplication = queryDeduplication;
    this.defaultOptions = defaultOptions || Object.create(null);
    this.typeDefs = typeDefs;

    if (ssrForceFetchDelay) {
      setTimeout(
        () => (this.disableNetworkFetches = false),
        ssrForceFetchDelay
      );
    }

    this.watchQuery = this.watchQuery.bind(this);
    this.query = this.query.bind(this);
    this.mutate = this.mutate.bind(this);
    this.resetStore = this.resetStore.bind(this);
    this.reFetchObservableQueries = this.reFetchObservableQueries.bind(this);

    this.version = version;

    this.localState = new LocalState({
      cache,
      client: this,
      resolvers,
      fragmentMatcher,
    });

    this.queryManager = new QueryManager({
      cache: this.cache,
      link: this.link,
      defaultOptions: this.defaultOptions,
      defaultContext,
      documentTransform,
      queryDeduplication,
      ssrMode,
      clientAwareness: {
        name: clientAwarenessName!,
        version: clientAwarenessVersion!,
      },
      localState: this.localState,
      assumeImmutableResults,
      onBroadcast:
        connectToDevTools ?
          () => {
            if (this.devToolsHookCb) {
              this.devToolsHookCb({
                action: {},
                state: {
                  queries: this.queryManager.getQueryStore(),
                  mutations: this.queryManager.mutationStore || {},
                },
                dataWithOptimisticResults: this.cache.extract(true),
              });
            }
          }
        : void 0,
    });

    if (connectToDevTools) this.connectToDevTools();
  }

  private connectToDevTools() {
    if (typeof window === "object") {
      type DevToolsConnector = {
        push(client: ApolloClient<any>): void;
      };
      const windowWithDevTools = window as Window & {
        [devtoolsSymbol]?: DevToolsConnector;
        __APOLLO_CLIENT__?: ApolloClient<any>;
      };
      const devtoolsSymbol = Symbol.for("apollo.devtools");
      (windowWithDevTools[devtoolsSymbol] =
        windowWithDevTools[devtoolsSymbol] || ([] as DevToolsConnector)).push(
        this
      );
      windowWithDevTools.__APOLLO_CLIENT__ = this;
    }

    /**
     * Suggest installing the devtools for developers who don't have them
     */
    if (!hasSuggestedDevtools && __DEV__) {
      hasSuggestedDevtools = true;
      setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          window.document &&
          window.top === window.self &&
          !(window as any).__APOLLO_DEVTOOLS_GLOBAL_HOOK__
        ) {
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

  /**
   * The `DocumentTransform` used to modify GraphQL documents before a request
   * is made. If a custom `DocumentTransform` is not provided, this will be the
   * default document transform.
   */
  get documentTransform() {
    return this.queryManager.documentTransform;
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
   * receive updated results through a GraphQL observer when the cache store changes.
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
    T = any,
    TVariables extends OperationVariables = OperationVariables,
  >(options: WatchQueryOptions<TVariables, T>): ObservableQuery<T, TVariables> {
    if (this.defaultOptions.watchQuery) {
      options = mergeOptions(this.defaultOptions.watchQuery, options);
    }

    // XXX Overwriting options is probably not the best way to do this long term...
    if (
      this.disableNetworkFetches &&
      (options.fetchPolicy === "network-only" ||
        options.fetchPolicy === "cache-and-network")
    ) {
      options = { ...options, fetchPolicy: "cache-first" };
    }

    return this.queryManager.watchQuery<T, TVariables>(options);
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
    T = any,
    TVariables extends OperationVariables = OperationVariables,
  >(options: QueryOptions<TVariables, T>): Promise<ApolloQueryResult<T>> {
    if (this.defaultOptions.query) {
      options = mergeOptions(this.defaultOptions.query, options);
    }

    invariant(
      (options.fetchPolicy as WatchQueryFetchPolicy) !== "cache-and-network",
      "The cache-and-network fetchPolicy does not work with client.query, because " +
        "client.query can only return a single result. Please use client.watchQuery " +
        "to receive multiple results from the cache and the network, or consider " +
        "using a different fetchPolicy, such as cache-first or network-only."
    );

    if (this.disableNetworkFetches && options.fetchPolicy === "network-only") {
      options = { ...options, fetchPolicy: "cache-first" };
    }

    return this.queryManager.query<T, TVariables>(options);
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
    TData = any,
    TVariables extends OperationVariables = OperationVariables,
    TContext extends Record<string, any> = DefaultContext,
    TCache extends ApolloCache<any> = ApolloCache<any>,
  >(
    options: MutationOptions<TData, TVariables, TContext>
  ): Promise<FetchResult<TData>> {
    if (this.defaultOptions.mutate) {
      options = mergeOptions(this.defaultOptions.mutate, options);
    }
    return this.queryManager.mutate<TData, TVariables, TContext, TCache>(
      options
    );
  }

  /**
   * This subscribes to a graphql subscription according to the options specified and returns an
   * `Observable` which either emits received data or an error.
   */
  public subscribe<
    T = any,
    TVariables extends OperationVariables = OperationVariables,
  >(options: SubscriptionOptions<TVariables, T>): Observable<FetchResult<T>> {
    return this.queryManager.startGraphQLSubscription<T>(options);
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
  public readQuery<T = any, TVariables = OperationVariables>(
    options: DataProxy.Query<TVariables, T>,
    optimistic: boolean = false
  ): T | null {
    return this.cache.readQuery<T, TVariables>(options, optimistic);
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
  public readFragment<T = any, TVariables = OperationVariables>(
    options: DataProxy.Fragment<TVariables, T>,
    optimistic: boolean = false
  ): T | null {
    return this.cache.readFragment<T, TVariables>(options, optimistic);
  }

  /**
   * Writes some data in the shape of the provided GraphQL query directly to
   * the store. This method will start at the root query. To start at a
   * specific id returned by `dataIdFromObject` then use `writeFragment`.
   */
  public writeQuery<TData = any, TVariables = OperationVariables>(
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
  public writeFragment<TData = any, TVariables = OperationVariables>(
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

  public __requestRaw(payload: GraphQLRequest): Observable<ExecutionResult> {
    return execute(this.link, payload);
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
  public resetStore(): Promise<ApolloQueryResult<any>[] | null> {
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
  ): Promise<ApolloQueryResult<any>[]> {
    return this.queryManager.reFetchObservableQueries(includeStandby);
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
    TCache extends ApolloCache<any> = ApolloCache<TCacheShape>,
    TResult = Promise<ApolloQueryResult<any>>,
  >(
    options: RefetchQueriesOptions<TCache, TResult>
  ): RefetchQueriesResult<TResult> {
    const map = this.queryManager.refetchQueries(
      options as RefetchQueriesOptions<ApolloCache<TCacheShape>, TResult>
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
  ): Map<string, ObservableQuery<any>> {
    return this.queryManager.getObservableQueries(include);
  }

  /**
   * Exposes the cache's complete state, in a serializable format for later restoration.
   */
  public extract(optimistic?: boolean): TCacheShape {
    return this.cache.extract(optimistic);
  }

  /**
   * Replaces existing state in the cache (if any) with the values expressed by
   * `serializedState`.
   *
   * Called when hydrating a cache (server side rendering, or offline storage),
   * and also (potentially) during hot reloads.
   */
  public restore(serializedState: TCacheShape): ApolloCache<TCacheShape> {
    return this.cache.restore(serializedState);
  }

  /**
   * Add additional local resolvers.
   */
  public addResolvers(resolvers: Resolvers | Resolvers[]) {
    this.localState.addResolvers(resolvers);
  }

  /**
   * Set (override existing) local resolvers.
   */
  public setResolvers(resolvers: Resolvers | Resolvers[]) {
    this.localState.setResolvers(resolvers);
  }

  /**
   * Get all registered local resolvers.
   */
  public getResolvers() {
    return this.localState.getResolvers();
  }

  /**
   * Set a custom local state fragment matcher.
   */
  public setLocalStateFragmentMatcher(fragmentMatcher: FragmentMatcher) {
    this.localState.setFragmentMatcher(fragmentMatcher);
  }

  /**
   * Define a new ApolloLink (or link chain) that Apollo Client will use.
   */
  public setLink(newLink: ApolloLink) {
    this.link = this.queryManager.link = newLink;
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
   *    parser: 1000,
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
   *    parser: 26,
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
