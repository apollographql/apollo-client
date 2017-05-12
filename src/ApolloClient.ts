import {
  NetworkInterface,
  createNetworkInterface,
} from './transport/networkInterface';

import {
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

import {
  createApolloStore,
  ApolloStore,
  createApolloReducer,
  ApolloReducerConfig,
  Store,
} from './store';

import {
  ApolloAction,
} from './actions';

import {
  CustomResolverMap,
} from './data/readFromStore';

import {
  QueryManager,
} from './core/QueryManager';

import {
  ApolloQueryResult,
  IdGetter,
} from './core/types';

import {
  ObservableQuery,
} from './core/ObservableQuery';

import {
  Observable,
} from './util/Observable';

import {
  isProduction,
} from './util/environment';

import {
  WatchQueryOptions,
  SubscriptionOptions,
  MutationOptions,
} from './core/watchQueryOptions';

import {
  storeKeyNameFromFieldNameAndArgs,
} from './data/storeUtils';

import {
  getFragmentQueryDocument,
} from './queries/getFromAST';

import {
  DataProxy,
  DataProxyReadQueryOptions,
  DataProxyReadFragmentOptions,
  DataProxyWriteQueryOptions,
  DataProxyWriteFragmentOptions,
  ReduxDataProxy,
} from './data/proxy';

import {
  version,
} from './version';


/**
 * This type defines a "selector" function that receives state from the Redux store
 * and returns the part of it that is managed by ApolloClient
 * @param state State of a Redux store
 * @returns {Store} Part of state managed by ApolloClient
 */
export type ApolloStateSelector = (state: any) => Store;

const DEFAULT_REDUX_ROOT_KEY = 'apollo';

function defaultReduxRootSelector(state: any) {
  return state[DEFAULT_REDUX_ROOT_KEY];
}

function defaultDataIdFromObject (result: any): string | null {
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
 * receive results from the server and cache the results in a Redux store. It also delivers updates
 * to GraphQL queries through {@link Observable} instances.
 */
export default class ApolloClient implements DataProxy {
  public networkInterface: NetworkInterface;
  public store: ApolloStore;
  public reduxRootSelector: ApolloStateSelector | null;
  public initialState: any;
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
   * @param reduxRootSelector A "selector" function that receives state from the Redux store
   * and returns the part of it that is managed by ApolloClient.
   * This option should only be used if the store is created outside of the client.
   *
   * @param initialState The initial state assigned to the store.
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

  constructor(options: {
    networkInterface?: NetworkInterface,
    reduxRootSelector?: string | ApolloStateSelector,
    initialState?: any,
    dataIdFromObject?: IdGetter,
    ssrMode?: boolean,
    ssrForceFetchDelay?: number
    addTypename?: boolean,
    customResolvers?: CustomResolverMap,
    connectToDevTools?: boolean,
    queryDeduplication?: boolean,
    fragmentMatcher?: FragmentMatcherInterface,
  } = {}) {
    let {
      dataIdFromObject,
    } = options;
    const {
      networkInterface,
      reduxRootSelector,
      initialState,
      ssrMode = false,
      ssrForceFetchDelay = 0,
      addTypename = true,
      customResolvers,
      connectToDevTools,
      fragmentMatcher,
      queryDeduplication = true,
    } = options;

    if (typeof reduxRootSelector === 'function') {
      this.reduxRootSelector = reduxRootSelector;
    } else if (typeof reduxRootSelector !== 'undefined') {
      throw new Error('"reduxRootSelector" must be a function.');
    }

    if (typeof fragmentMatcher === 'undefined') {
      this.fragmentMatcher = new HeuristicFragmentMatcher();
    } else {
      this.fragmentMatcher = fragmentMatcher;
    }

    this.initialState = initialState ? initialState : {};
    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface({ uri: '/graphql' });
    this.addTypename = addTypename;
    this.disableNetworkFetches = ssrMode || ssrForceFetchDelay > 0;
    this.dataId = dataIdFromObject = dataIdFromObject || defaultDataIdFromObject;
    this.dataIdFromObject = this.dataId;
    this.fieldWithArgs = storeKeyNameFromFieldNameAndArgs;
    this.queryDeduplication = queryDeduplication;
    this.ssrMode = ssrMode;

    if (ssrForceFetchDelay) {
      setTimeout(() => this.disableNetworkFetches = false, ssrForceFetchDelay);
    }

    this.reducerConfig = {
      dataIdFromObject,
      customResolvers,
      addTypename,
      fragmentMatcher: this.fragmentMatcher.match,
    };

    this.watchQuery = this.watchQuery.bind(this);
    this.query = this.query.bind(this);
    this.mutate = this.mutate.bind(this);
    this.setStore = this.setStore.bind(this);
    this.resetStore = this.resetStore.bind(this);

    // Attach the client instance to window to let us be found by chrome devtools, but only in
    // development mode
    const defaultConnectToDevTools =
      !isProduction() &&
      typeof window !== 'undefined' && (!(window as any).__APOLLO_CLIENT__);

    if (typeof connectToDevTools === 'undefined' ? defaultConnectToDevTools : connectToDevTools) {
      (window as any).__APOLLO_CLIENT__ = this;
    }

    /**
     * Suggest installing the devtools for developers who don't have them
     */
    if (!hasSuggestedDevtools && !isProduction()) {
      hasSuggestedDevtools = true;
      if ( typeof window !== 'undefined' && window.document && window.top === window.self) {

        // First check if devtools is not installed
        if (typeof (window as any).__APOLLO_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
          // Only for Chrome
          if (navigator.userAgent.indexOf('Chrome') > -1) {
            // tslint:disable-next-line
            console.debug('Download the Apollo DevTools ' +
            'for a better development experience: ' +
            'https://chrome.google.com/webstore/detail/apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm');
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
    this.initStore();

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
    this.initStore();

    if (options.fetchPolicy === 'cache-and-network') {
      throw new Error('cache-and-network fetchPolicy can only be used with watchQuery');
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
  public mutate<T>(options: MutationOptions): Promise<ApolloQueryResult<T>> {
    this.initStore();

    return this.queryManager.mutate<T>(options);
  }

  public subscribe(options: SubscriptionOptions): Observable<any> {
    this.initStore();

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

  /**
   * Returns a reducer function configured according to the `reducerConfig` instance variable.
   */
  public reducer(): (state: Store, action: ApolloAction) => Store  {
    return createApolloReducer(this.reducerConfig);
  }

  public __actionHookForDevTools(cb: Function) {
    this.devToolsHookCb = cb;
  }

  public middleware = () => {
    return (store: ApolloStore) => {
      this.setStore(store);

      return (next: any) => (action: any) => {
        const previousApolloState = this.queryManager.selectApolloState(store);
        const returnValue = next(action);
        const newApolloState = this.queryManager.selectApolloState(store);

        if (newApolloState !== previousApolloState) {
          this.queryManager.broadcastNewStore(store.getState());
        }

        if (this.devToolsHookCb) {
          this.devToolsHookCb({
            action,
            state: this.queryManager.getApolloState(),
            dataWithOptimisticResults: this.queryManager.getDataWithOptimisticResults(),
          });
        }

        return returnValue;
      };
    };
  }

  /**
   * This initializes the Redux store that we use as a reactive cache.
   */
  public initStore() {
    if (this.store) {
      // Don't do anything if we already have a store
      return;
    }

    if (this.reduxRootSelector) {
      throw new Error(
          'Cannot initialize the store because "reduxRootSelector" is provided. ' +
          'reduxRootSelector should only be used when the store is created outside of the client. ' +
          'This may lead to unexpected results when querying the store internally. ' +
          `Please remove that option from ApolloClient constructor.`,
      );
    }

    // If we don't have a store already, initialize a default one
    this.setStore(createApolloStore({
      reduxRootKey: DEFAULT_REDUX_ROOT_KEY,
      initialState: this.initialState,
      config: this.reducerConfig,
      logger: (store: any) => (next: any) => (action: any) => {
        const result = next(action);

        if (this.devToolsHookCb) {
          this.devToolsHookCb({
            action,
            state: this.queryManager.getApolloState(),
            dataWithOptimisticResults: this.queryManager.getDataWithOptimisticResults(),
          });
        }

        return result;
      },
    }));
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
  public resetStore() {
    if (this.queryManager) {
      this.queryManager.resetStore();
    }
  }

  public getInitialState(): { data: Object } {
    this.initStore();
    return this.queryManager.getInitialState();
  }

  private setStore(store: ApolloStore) {
    let reduxRootSelector: ApolloStateSelector;
    if (this.reduxRootSelector) {
      reduxRootSelector = this.reduxRootSelector;
    } else {
      reduxRootSelector = defaultReduxRootSelector;
    }

    // ensure existing store has apolloReducer
    if (typeof reduxRootSelector(store.getState()) === 'undefined') {
      throw new Error(
          'Existing store does not use apolloReducer. Please make sure the store ' +
          'is properly configured and "reduxRootSelector" is correctly specified.',
      );
    }

    this.store = store;

    this.queryManager = new QueryManager({
      networkInterface: this.networkInterface,
      reduxRootSelector: reduxRootSelector,
      store,
      addTypename: this.addTypename,
      reducerConfig: this.reducerConfig,
      queryDeduplication: this.queryDeduplication,
      fragmentMatcher: this.fragmentMatcher,
      ssrMode: this.ssrMode,
    });
  }

  /**
   * Initializes a data proxy for this client instance if one does not already
   * exist and returns either a previously initialized proxy instance or the
   * newly initialized instance.
   */
  private initProxy(): DataProxy {
    if (!this.proxy) {
      this.initStore();
      this.proxy = new ReduxDataProxy(
        this.store,
        this.reduxRootSelector || defaultReduxRootSelector,
        this.fragmentMatcher,
        this.reducerConfig,
      );
    }
    return this.proxy;
  }
}
