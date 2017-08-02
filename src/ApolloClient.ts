import {
  NetworkInterface,
  ObservableNetworkInterface,
  createNetworkInterface,
  Request,
} from './transport/networkInterface';

import { execute, ApolloLink } from 'apollo-link-core';

import {
  ExecutionResult,
  // We need to import this here to allow TypeScript to include it in the definition file even
  // though we don't use it. https://github.com/Microsoft/TypeScript/issues/5711
  // We need to disable the linter here because TSLint rightfully complains that this is unused.
  /* tslint:disable */
  SelectionSetNode,
  /* tslint:enable */
  DocumentNode,
  FragmentDefinitionNode,
} from 'graphql';

import {
  HeuristicFragmentMatcher,
  FragmentMatcherInterface,
} from './data/fragmentMatcher';

import { ApolloReducerConfig } from './store';

import { CustomResolverMap } from './data/readFromStore';

import { QueryManager } from './core/QueryManager';

import {
  ApolloQueryResult,
  ApolloExecutionResult,
  IdGetter,
} from './core/types';

import { ObservableQuery } from './core/ObservableQuery';

import { Observable } from './util/Observable';

import { isProduction } from './util/environment';

import {
  WatchQueryOptions,
  SubscriptionOptions,
  MutationOptions,
} from './core/watchQueryOptions';

import { getStoreKeyName } from './data/storeUtils';

import { getFragmentQueryDocument } from './queries/getFromAST';

import {
  DataProxy,
  DataProxyReadQueryOptions,
  DataProxyReadFragmentOptions,
  DataProxyWriteQueryOptions,
  DataProxyWriteFragmentOptions,
} from './data/proxy';

import { version } from './version';

import { InMemoryCache } from './data/inMemoryCache';
import { Cache } from './data/cache';

function defaultDataIdFromObject(result: any): string | null {
  if (result.__typename) {
    if (result.id !== undefined) {
      return `${result.__typename}:${result.id}`;
    }
    if (result._id !== undefined) {
      return `${result.__typename}:${result._id}`;
    }
  }
  return null;
}

let hasSuggestedDevtools = false;

/**
 * This is the primary Apollo Client class. It is used to send GraphQL documents (i.e. queries
 * and mutations) to a GraphQL spec-compliant server over a {@link NetworkInterface} instance,
 * receive results from the server and cache the results in a store. It also delivers updates
 * to GraphQL queries through {@link Observable} instances.
 */
export default class ApolloClient implements DataProxy {
  public networkInterface: NetworkInterface;
  public initialState: any;
  public initialCache: Cache;
  public queryManager: QueryManager;
  public reducerConfig: ApolloReducerConfig;
  public addTypename: boolean;
  public disableNetworkFetches: boolean;
  /**
   * The dataIdFromObject function used by this client instance.
   */
  public dataId: IdGetter | undefined;
  /**
   * The dataIdFromObject function used by this client instance.
   */
  public dataIdFromObject: IdGetter | undefined;
  public fieldWithArgs: (fieldName: string, args?: Object) => string;
  public version: string;
  public queryDeduplication: boolean;

  private devToolsHookCb: Function;
  private proxy: DataProxy | undefined;
  private fragmentMatcher: FragmentMatcherInterface;
  private ssrMode: boolean;

  /**
   * Constructs an instance of {@link ApolloClient}.
   *
   * @param networkInterface The {@link NetworkInterface} over which GraphQL documents will be sent
   * to a GraphQL spec-compliant server.
   *
   * @param initialState The initial state assigned to the store.
   *
   * @param initialCache The initial cache to use in the data store.
   *
   * @param dataIdFromObject A function that returns a object identifier given a particular result
   * object.
   *
   * @param ssrMode Determines whether this is being run in Server Side Rendering (SSR) mode.
   *
   * @param ssrForceFetchDelay Determines the time interval before we force fetch queries for a
   * server side render.
   *
   * @param addTypename Adds the __typename field to every level of a GraphQL document, required
   * to support certain queries that contain fragments.
   *
   * @param queryDeduplication If set to false, a query will still be sent to the server even if a query
   * with identical parameters (query, variables, operationName) is already in flight.
   *
   * @param fragmentMatcher A function to use for matching fragment conditions in GraphQL documents
   */

  constructor(
    options: {
      networkInterface?:
        | NetworkInterface
        | ObservableNetworkInterface
        | ApolloLink;
      initialState?: any;
      initialCache?: Cache;
      dataIdFromObject?: IdGetter;
      ssrMode?: boolean;
      ssrForceFetchDelay?: number;
      addTypename?: boolean;
      customResolvers?: CustomResolverMap;
      connectToDevTools?: boolean;
      queryDeduplication?: boolean;
      fragmentMatcher?: FragmentMatcherInterface;
    } = {}
  ) {
    let { dataIdFromObject } = options;
    const {
      networkInterface,
      initialState,
      initialCache,
      ssrMode = false,
      ssrForceFetchDelay = 0,
      addTypename = true,
      customResolvers,
      connectToDevTools,
      fragmentMatcher,
      queryDeduplication = true,
    } = options;

    if (typeof fragmentMatcher === 'undefined') {
      this.fragmentMatcher = new HeuristicFragmentMatcher();
    } else {
      this.fragmentMatcher = fragmentMatcher;
    }

    const createQuery = (
      getResult: (request: Request) => Observable<ExecutionResult>
    ) => {
      let resolved = false;
      return (request: Request) =>
        new Promise<ExecutionResult>((resolve, reject) => {
          const subscription = getResult(request).subscribe({
            next: (data: ExecutionResult) => {
              if (!resolved) {
                resolve(data);
                resolved = true;
              } else {
                console.warn(
                  'Apollo Client does not support multiple results from an Observable'
                );
              }
            },
            error: reject,
            complete: () => subscription.unsubscribe(),
          });
        });
    };

    if (networkInterface instanceof ApolloLink) {
      this.networkInterface = {
        query: createQuery((request: Request) => {
          return (execute(
            networkInterface as ApolloLink,
            request
          ) as any) as Observable<ExecutionResult>;
        }),
      };
    } else if (
      networkInterface &&
      typeof (<ObservableNetworkInterface>networkInterface).request ===
        'function'
    ) {
      console.warn(`The Observable Network interface will be deprecated`);
      this.networkInterface = {
        ...networkInterface,
        query: createQuery(
          (networkInterface as ObservableNetworkInterface).request
        ),
      };
    } else {
      this.networkInterface = networkInterface
        ? <NetworkInterface>networkInterface
        : createNetworkInterface({ uri: '/graphql' });
    }

    this.initialState = initialState ? initialState : {};
    this.addTypename = addTypename;
    this.disableNetworkFetches = ssrMode || ssrForceFetchDelay > 0;
    this.dataId = dataIdFromObject =
      dataIdFromObject || defaultDataIdFromObject;
    this.dataIdFromObject = this.dataId;
    this.fieldWithArgs = getStoreKeyName;
    this.queryDeduplication = queryDeduplication;
    this.ssrMode = ssrMode;

    if (ssrForceFetchDelay) {
      setTimeout(
        () => (this.disableNetworkFetches = false),
        ssrForceFetchDelay
      );
    }

    this.reducerConfig = {
      dataIdFromObject,
      customResolvers,
      addTypename,
      fragmentMatcher: this.fragmentMatcher.match,
    };

    this.initialCache = initialCache
      ? initialCache
      : new InMemoryCache(
          this.reducerConfig,
          this.initialState && this.initialState.data
            ? this.initialState.data
            : {}
        );

    this.watchQuery = this.watchQuery.bind(this);
    this.query = this.query.bind(this);
    this.mutate = this.mutate.bind(this);
    this.resetStore = this.resetStore.bind(this);

    // Attach the client instance to window to let us be found by chrome devtools, but only in
    // development mode
    const defaultConnectToDevTools =
      !isProduction() &&
      typeof window !== 'undefined' &&
      !(window as any).__APOLLO_CLIENT__;

    if (
      typeof connectToDevTools === 'undefined'
        ? defaultConnectToDevTools
        : connectToDevTools
    ) {
      (window as any).__APOLLO_CLIENT__ = this;
    }

    /**
     * Suggest installing the devtools for developers who don't have them
     */
    if (!hasSuggestedDevtools && !isProduction()) {
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
          if (navigator.userAgent.indexOf('Chrome') > -1) {
            // tslint:disable-next-line
            console.debug(
              'Download the Apollo DevTools ' +
                'for a better development experience: ' +
                'https://chrome.google.com/webstore/detail/apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm'
            );
          }
        }
      }
    }
    this.version = version;
  }
  /**
   * This watches the results of the query according to the options specified and
   * returns an {@link ObservableQuery}. We can subscribe to this {@link ObservableQuery} and
   * receive updated results through a GraphQL observer.
   * <p /><p />
   * Note that this method is not an implementation of GraphQL subscriptions. Rather,
   * it uses Apollo's store in order to reactively deliver updates to your query results.
   * <p /><p />
   * For example, suppose you call watchQuery on a GraphQL query that fetches an person's
   * first name and last name and this person has a particular object identifer, provided by
   * dataIdFromObject. Later, a different query fetches that same person's
   * first and last name and his/her first name has now changed. Then, any observers associated
   * with the results of the first query will be updated with a new result object.
   * <p /><p />
   * See [here](https://medium.com/apollo-stack/the-concepts-of-graphql-bc68bd819be3#.3mb0cbcmc) for
   * a description of store reactivity.
   *
   */
  public watchQuery<T>(options: WatchQueryOptions): ObservableQuery<T> {
    this.initQueryManager();

    // XXX Overwriting options is probably not the best way to do this long term...
    if (this.disableNetworkFetches && options.fetchPolicy === 'network-only') {
      options = {
        ...options,
        fetchPolicy: 'cache-first',
      } as WatchQueryOptions;
    }

    return this.queryManager.watchQuery<T>(options);
  }

  /**
   * This resolves a single query according to the options specified and returns a
   * {@link Promise} which is either resolved with the resulting data or rejected
   * with an error.
   *
   * @param options An object of type {@link WatchQueryOptions} that allows us to describe
   * how this query should be treated e.g. whether it is a polling query, whether it should hit the
   * server at all or just resolve from the cache, etc.
   */
  public query<T>(options: WatchQueryOptions): Promise<ApolloQueryResult<T>> {
    this.initQueryManager();

    if (options.fetchPolicy === 'cache-and-network') {
      throw new Error(
        'cache-and-network fetchPolicy can only be used with watchQuery'
      );
    }

    // XXX Overwriting options is probably not the best way to do this long term...
    if (this.disableNetworkFetches && options.fetchPolicy === 'network-only') {
      options = {
        ...options,
        fetchPolicy: 'cache-first',
      } as WatchQueryOptions;
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
  public mutate<T>(
    options: MutationOptions<T>
  ): Promise<ApolloExecutionResult<T>> {
    this.initQueryManager();

    return this.queryManager.mutate<T>(options);
  }

  /**
   * This subscribes to a graphql subscription according to the options specified and returns an
   * {@link Observable} which either emits received data or an error.
   */
  public subscribe(options: SubscriptionOptions): Observable<any> {
    this.initQueryManager();

    return this.queryManager.startGraphQLSubscription(options);
  }

  /**
   * Tries to read some data from the store in the shape of the provided
   * GraphQL query without making a network request. This method will start at
   * the root query. To start at a specific id returned by `dataIdFromObject`
   * use `readFragment`.
   */
  public readQuery<T>(options: DataProxyReadQueryOptions): T {
    return this.initProxy().readQuery<T>(options);
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
   */
  public readFragment<T>(options: DataProxyReadFragmentOptions): T | null {
    return this.initProxy().readFragment<T>(options);
  }

  /**
   * Writes some data in the shape of the provided GraphQL query directly to
   * the store. This method will start at the root query. To start at a a
   * specific id returned by `dataIdFromObject` then use `writeFragment`.
   */
  public writeQuery(options: DataProxyWriteQueryOptions): void {
    return this.initProxy().writeQuery(options);
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
  public writeFragment(options: DataProxyWriteFragmentOptions): void {
    return this.initProxy().writeFragment(options);
  }

  public __actionHookForDevTools(cb: Function) {
    this.devToolsHookCb = cb;
  }

  /**
   * This initializes the query manager that tracks queries and the cache
   */
  public initQueryManager() {
    if (this.queryManager) {
      return;
    }

    this.queryManager = new QueryManager({
      networkInterface: this.networkInterface,
      addTypename: this.addTypename,
      reducerConfig: this.reducerConfig,
      queryDeduplication: this.queryDeduplication,
      fragmentMatcher: this.fragmentMatcher,
      ssrMode: this.ssrMode,
      initialCache: this.initialCache,
      onBroadcast: () => {
        if (this.devToolsHookCb) {
          this.devToolsHookCb({
            action: {},
            state: {
              queries: this.queryManager.queryStore.getStore(),
              mutations: this.queryManager.mutationStore.getStore(),
            },
            dataWithOptimisticResults: (this.queryManager.dataStore.getCache() as InMemoryCache).getOptimisticData(),
          });
        }
      },
    });
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
  public resetStore(): Promise<ApolloQueryResult<any>[]> | null {
    return this.queryManager ? this.queryManager.resetStore() : null;
  }

  /**
   * Initializes a data proxy for this client instance if one does not already
   * exist and returns either a previously initialized proxy instance or the
   * newly initialized instance.
   */
  private initProxy(): DataProxy {
    if (!this.proxy) {
      this.initQueryManager();
      this.proxy = this.queryManager.dataStore.getCache();
    }
    return this.proxy;
  }
}
