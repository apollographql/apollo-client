import {
  ApolloLink,
  FetchResult,
  GraphQLRequest,
  execute,
} from 'apollo-link';
import { ExecutionResult, DocumentNode } from 'graphql';
import { ApolloCache, DataProxy } from 'apollo-cache';

import { invariant, InvariantError } from 'ts-invariant';

import { QueryManager } from './core/QueryManager';
import {
  ApolloQueryResult,
  OperationVariables,
  Resolvers,
} from './core/types';
import { ObservableQuery } from './core/ObservableQuery';
import { LocalState, FragmentMatcher } from './core/LocalState';
import { Observable } from './util/Observable';

import {
  QueryOptions,
  WatchQueryOptions,
  SubscriptionOptions,
  MutationOptions,
  WatchQueryFetchPolicy,
} from './core/watchQueryOptions';

import { DataStore } from './data/store';

import { version } from './version';

export interface DefaultOptions {
  watchQuery?: Partial<WatchQueryOptions>;
  query?: Partial<QueryOptions>;
  mutate?: Partial<MutationOptions>;
}

let hasSuggestedDevtools = false;

export type ApolloClientOptions<TCacheShape> = {
  link?: ApolloLink;
  cache: ApolloCache<TCacheShape>;
  ssrForceFetchDelay?: number;
  ssrMode?: boolean;
  connectToDevTools?: boolean;
  queryDeduplication?: boolean;
  defaultOptions?: DefaultOptions;
  assumeImmutableResults?: boolean;
  resolvers?: Resolvers | Resolvers[];
  typeDefs?: string | string[] | DocumentNode | DocumentNode[];
  fragmentMatcher?: FragmentMatcher;
  name?: string;
  version?: string;
};

/**
 * This is the primary Apollo Client class. It is used to send GraphQL documents (i.e. queries
 * and mutations) to a GraphQL spec-compliant server over a {@link NetworkInterface} instance,
 * receive results from the server and cache the results in a store. It also delivers updates
 * to GraphQL queries through {@link Observable} instances.
 */
export default class ApolloClient<TCacheShape> implements DataProxy {
  public link: ApolloLink;
  public store: DataStore<TCacheShape>;
  public cache: ApolloCache<TCacheShape>;
  public readonly queryManager: QueryManager<TCacheShape>;
  public disableNetworkFetches: boolean;
  public version: string;
  public queryDeduplication: boolean;
  public defaultOptions: DefaultOptions = {};
  public readonly typeDefs: ApolloClientOptions<TCacheShape>['typeDefs'];

  private devToolsHookCb: Function;
  private resetStoreCallbacks: Array<() => Promise<any>> = [];
  private clearStoreCallbacks: Array<() => Promise<any>> = [];
  private localState: LocalState<TCacheShape>;

  /**
   * Constructs an instance of {@link ApolloClient}.
   *
   * @param link The {@link ApolloLink} over which GraphQL documents will be resolved into a response.
   *
   * @param cache The initial cache to use in the data store.
   *
   * @param ssrMode Determines whether this is being run in Server Side Rendering (SSR) mode.
   *
   * @param ssrForceFetchDelay Determines the time interval before we force fetch queries for a
   * server side render.
   *
   * @param queryDeduplication If set to false, a query will still be sent to the server even if a query
   * with identical parameters (query, variables, operationName) is already in flight.
   *
   * @param defaultOptions Used to set application wide defaults for the
   *                       options supplied to `watchQuery`, `query`, or
   *                       `mutate`.
   *
   * @param assumeImmutableResults When this option is true, the client will assume results
   *                               read from the cache are never mutated by application code,
   *                               which enables substantial performance optimizations. Passing
   *                               `{ freezeResults: true }` to the `InMemoryCache` constructor
   *                               can help enforce this immutability.
   *
   * @param name A custom name that can be used to identify this client, when
   *             using Apollo client awareness features. E.g. "iOS".
   *
   * @param version A custom version that can be used to identify this client,
   *                when using Apollo client awareness features. This is the
   *                version of your client, which you may want to increment on
   *                new builds. This is NOT the version of Apollo Client that
   *                you are using.
   */
  constructor(options: ApolloClientOptions<TCacheShape>) {
    const {
      cache,
      ssrMode = false,
      ssrForceFetchDelay = 0,
      connectToDevTools,
      queryDeduplication = true,
      defaultOptions,
      assumeImmutableResults = false,
      resolvers,
      typeDefs,
      fragmentMatcher,
      name: clientAwarenessName,
      version: clientAwarenessVersion,
    } = options;

    let { link } = options;

    // If a link hasn't been defined, but local state resolvers have been set,
    // setup a default empty link.
    if (!link && resolvers) {
      link = ApolloLink.empty();
    }

    if (!link || !cache) {
      throw new InvariantError(
        "In order to initialize Apollo Client, you must specify 'link' and 'cache' properties in the options object.\n" +
        "These options are part of the upgrade requirements when migrating from Apollo Client 1.x to Apollo Client 2.x.\n" +
        "For more information, please visit: https://www.apollographql.com/docs/tutorial/client.html#apollo-client-setup"
      );
    }

    // remove apollo-client supported directives
    this.link = link;
    this.cache = cache;
    this.store = new DataStore(cache);
    this.disableNetworkFetches = ssrMode || ssrForceFetchDelay > 0;
    this.queryDeduplication = queryDeduplication;
    this.defaultOptions = defaultOptions || {};
    this.typeDefs = typeDefs;

    if (ssrForceFetchDelay) {
      setTimeout(
        () => (this.disableNetworkFetches = false),
        ssrForceFetchDelay,
      );
    }

    this.watchQuery = this.watchQuery.bind(this);
    this.query = this.query.bind(this);
    this.mutate = this.mutate.bind(this);
    this.resetStore = this.resetStore.bind(this);
    this.reFetchObservableQueries = this.reFetchObservableQueries.bind(this);

    // Attach the client instance to window to let us be found by chrome devtools, but only in
    // development mode
    const defaultConnectToDevTools =
      process.env.NODE_ENV !== 'production' &&
      typeof window !== 'undefined' &&
      !(window as any).__APOLLO_CLIENT__;

    if (
      typeof connectToDevTools === 'undefined'
        ? defaultConnectToDevTools
        : connectToDevTools && typeof window !== 'undefined'
    ) {
      (window as any).__APOLLO_CLIENT__ = this;
    }

    /**
     * Suggest installing the devtools for developers who don't have them
     */
    if (!hasSuggestedDevtools && process.env.NODE_ENV !== 'production') {
      hasSuggestedDevtools = true;
      if (
        typeof window !== 'undefined' &&
        window.document &&
        window.top === window.self
      ) {
        // First check if devtools is not installed
        if (
          typeof (window as any).__APOLLO_DEVTOOLS_GLOBAL_HOOK__ === 'undefined'
        ) {
          // Only for Chrome
          if (
            window.navigator &&
            window.navigator.userAgent &&
            window.navigator.userAgent.indexOf('Chrome') > -1
          ) {
            // tslint:disable-next-line
            console.debug(
              'Download the Apollo DevTools ' +
                'for a better development experience: ' +
                'https://chrome.google.com/webstore/detail/apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm',
            );
          }
        }
      }
    }

    this.version = version;

    this.localState = new LocalState({
      cache,
      client: this,
      resolvers,
      fragmentMatcher,
    });

    this.queryManager = new QueryManager({
      link: this.link,
      store: this.store,
      queryDeduplication,
      ssrMode,
      clientAwareness: {
        name: clientAwarenessName!,
        version: clientAwarenessVersion!,
      },
      localState: this.localState,
      assumeImmutableResults,
      onBroadcast: () => {
        if (this.devToolsHookCb) {
          this.devToolsHookCb({
            action: {},
            state: {
              queries: this.queryManager.queryStore.getStore(),
              mutations: this.queryManager.mutationStore.getStore(),
            },
            dataWithOptimisticResults: this.cache.extract(true),
          });
        }
      },
    });
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
   * returns an {@link ObservableQuery}. We can subscribe to this {@link ObservableQuery} and
   * receive updated results through a GraphQL observer when the cache store changes.
   * <p /><p />
   * Note that this method is not an implementation of GraphQL subscriptions. Rather,
   * it uses Apollo's store in order to reactively deliver updates to your query results.
   * <p /><p />
   * For example, suppose you call watchQuery on a GraphQL query that fetches a person's
   * first and last name and this person has a particular object identifer, provided by
   * dataIdFromObject. Later, a different query fetches that same person's
   * first and last name and the first name has now changed. Then, any observers associated
   * with the results of the first query will be updated with a new result object.
   * <p /><p />
   * Note that if the cache does not change, the subscriber will *not* be notified.
   * <p /><p />
   * See [here](https://medium.com/apollo-stack/the-concepts-of-graphql-bc68bd819be3#.3mb0cbcmc) for
   * a description of store reactivity.
   */
  public watchQuery<T = any, TVariables = OperationVariables>(
    options: WatchQueryOptions<TVariables>,
  ): ObservableQuery<T, TVariables> {
    if (this.defaultOptions.watchQuery) {
      options = {
        ...this.defaultOptions.watchQuery,
        ...options,
      } as WatchQueryOptions<TVariables>;
    }

    // XXX Overwriting options is probably not the best way to do this long term...
    if (
      this.disableNetworkFetches &&
      (options.fetchPolicy === 'network-only' ||
        options.fetchPolicy === 'cache-and-network')
    ) {
      options = { ...options, fetchPolicy: 'cache-first' };
    }

    return this.queryManager.watchQuery<T, TVariables>(options);
  }

  /**
   * This resolves a single query according to the options specified and
   * returns a {@link Promise} which is either resolved with the resulting data
   * or rejected with an error.
   *
   * @param options An object of type {@link QueryOptions} that allows us to
   * describe how this query should be treated e.g. whether it should hit the
   * server at all or just resolve from the cache, etc.
   */
  public query<T = any, TVariables = OperationVariables>(
    options: QueryOptions<TVariables>,
  ): Promise<ApolloQueryResult<T>> {
    if (this.defaultOptions.query) {
      options = { ...this.defaultOptions.query, ...options } as QueryOptions<
        TVariables
      >;
    }

    invariant(
      (options.fetchPolicy as WatchQueryFetchPolicy) !== 'cache-and-network',
      'The cache-and-network fetchPolicy does not work with client.query, because ' +
      'client.query can only return a single result. Please use client.watchQuery ' +
      'to receive multiple results from the cache and the network, or consider ' +
      'using a different fetchPolicy, such as cache-first or network-only.'
    );

    if (this.disableNetworkFetches && options.fetchPolicy === 'network-only') {
      options = { ...options, fetchPolicy: 'cache-first' };
    }

    return this.queryManager.query<T>(options);
  }

  /**
   * This resolves a single mutation according to the options specified and returns a
   * {@link Promise} which is either resolved with the resulting data or rejected with an
   * error.
   *
   * It takes options as an object with the following keys and values:
   */
  public mutate<T = any, TVariables = OperationVariables>(
    options: MutationOptions<T, TVariables>,
  ): Promise<FetchResult<T>> {
    if (this.defaultOptions.mutate) {
      options = {
        ...this.defaultOptions.mutate,
        ...options,
      } as MutationOptions<T, TVariables>;
    }

    return this.queryManager.mutate<T>(options);
  }

  /**
   * This subscribes to a graphql subscription according to the options specified and returns an
   * {@link Observable} which either emits received data or an error.
   */
  public subscribe<T = any, TVariables = OperationVariables>(
    options: SubscriptionOptions<TVariables>,
  ): Observable<FetchResult<T>> {
    return this.queryManager.startGraphQLSubscription<T>(options);
  }

  /**
   * Tries to read some data from the store in the shape of the provided
   * GraphQL query without making a network request. This method will start at
   * the root query. To start at a specific id returned by `dataIdFromObject`
   * use `readFragment`.
   *
   * @param optimistic Set to `true` to allow `readQuery` to return
   * optimistic results. Is `false` by default.
   */
  public readQuery<T = any, TVariables = OperationVariables>(
    options: DataProxy.Query<TVariables>,
    optimistic: boolean = false,
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
   * @param optimistic Set to `true` to allow `readFragment` to return
   * optimistic results. Is `false` by default.
   */
  public readFragment<T = any, TVariables = OperationVariables>(
    options: DataProxy.Fragment<TVariables>,
    optimistic: boolean = false,
  ): T | null {
    return this.cache.readFragment<T, TVariables>(options, optimistic);
  }

  /**
   * Writes some data in the shape of the provided GraphQL query directly to
   * the store. This method will start at the root query. To start at a
   * specific id returned by `dataIdFromObject` then use `writeFragment`.
   */
  public writeQuery<TData = any, TVariables = OperationVariables>(
    options: DataProxy.WriteQueryOptions<TData, TVariables>,
  ): void {
    const result = this.cache.writeQuery<TData, TVariables>(options);
    this.queryManager.broadcastQueries();
    return result;
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
    options: DataProxy.WriteFragmentOptions<TData, TVariables>,
  ): void {
    const result = this.cache.writeFragment<TData, TVariables>(options);
    this.queryManager.broadcastQueries();
    return result;
  }

  /**
   * Sugar for writeQuery & writeFragment
   * This method will construct a query from the data object passed in.
   * If no id is supplied, writeData will write the data to the root.
   * If an id is supplied, writeData will write a fragment to the object
   * specified by the id in the store.
   *
   * Since you aren't passing in a query to check the shape of the data,
   * you must pass in an object that conforms to the shape of valid GraphQL data.
   */
  public writeData<TData = any>(
    options: DataProxy.WriteDataOptions<TData>,
  ): void {
    const result = this.cache.writeData<TData>(options);
    this.queryManager.broadcastQueries();
    return result;
  }

  public __actionHookForDevTools(cb: () => any) {
    this.devToolsHookCb = cb;
  }

  public __requestRaw(payload: GraphQLRequest): Observable<ExecutionResult> {
    return execute(this.link, payload);
  }

  /**
   * This initializes the query manager that tracks queries and the cache
   */
  public initQueryManager(): QueryManager<TCacheShape> {
    invariant.warn(
      'Calling the initQueryManager method is no longer necessary, ' +
        'and it will be removed from ApolloClient in version 3.0.',
    );
    return this.queryManager;
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
      .then(() => this.queryManager.clearStore())
      .then(() => Promise.all(this.resetStoreCallbacks.map(fn => fn())))
      .then(() => this.reFetchObservableQueries());
  }

  /**
   * Remove all data from the store. Unlike `resetStore`, `clearStore` will
   * not refetch any active queries.
   */
  public clearStore(): Promise<any[]> {
    return Promise.resolve()
      .then(() => this.queryManager.clearStore())
      .then(() => Promise.all(this.clearStoreCallbacks.map(fn => fn())));
  }

  /**
   * Allows callbacks to be registered that are executed when the store is
   * reset. `onResetStore` returns an unsubscribe function that can be used
   * to remove registered callbacks.
   */
  public onResetStore(cb: () => Promise<any>): () => void {
    this.resetStoreCallbacks.push(cb);
    return () => {
      this.resetStoreCallbacks = this.resetStoreCallbacks.filter(c => c !== cb);
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
      this.clearStoreCallbacks = this.clearStoreCallbacks.filter(c => c !== cb);
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
    includeStandby?: boolean,
  ): Promise<ApolloQueryResult<any>[]> {
    return this.queryManager.reFetchObservableQueries(includeStandby);
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
}
