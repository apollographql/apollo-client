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
  createApolloStore,
  ApolloStore,
  createApolloReducer,
  ApolloReducerConfig,
  Store,
} from './store';

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
  public shouldForceFetch: boolean;
  public dataId: IdGetter | undefined;
  public fieldWithArgs: (fieldName: string, args?: Object) => string;
  public version: string;
  public queryDeduplication: boolean;

  private devToolsHookCb: Function;
  private proxy: DataProxy | undefined;

  /**
   * Constructs an instance of {@link ApolloClient}.
   *
   * @param networkInterface The {@link NetworkInterface} over which GraphQL documents will be sent
   * to a GraphQL spec-compliant server.
   *
   * @param reduxRootSelector Either a "selector" function that receives state from the Redux store
   * and returns the part of it that is managed by ApolloClient or a key that points to that state.
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
  } = {}) {
    const {
      networkInterface,
      reduxRootSelector,
      initialState,
      dataIdFromObject,
      ssrMode = false,
      ssrForceFetchDelay = 0,
      addTypename = true,
      customResolvers,
      connectToDevTools,
      queryDeduplication = true,
    } = options;

    if (typeof reduxRootSelector === 'function') {
      this.reduxRootSelector = reduxRootSelector;
    } else if (typeof reduxRootSelector !== 'undefined') {
      throw new Error('"reduxRootSelector" must be a function.');
    }

    this.initialState = initialState ? initialState : {};
    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface({ uri: '/graphql' });
    this.addTypename = addTypename;
    this.shouldForceFetch = !(ssrMode || ssrForceFetchDelay > 0);
    this.dataId = dataIdFromObject;
    this.fieldWithArgs = storeKeyNameFromFieldNameAndArgs;
    this.queryDeduplication = queryDeduplication;

    if (ssrForceFetchDelay) {
      setTimeout(() => this.shouldForceFetch = true, ssrForceFetchDelay);
    }

    this.reducerConfig = {
      dataIdFromObject,
      customResolvers,
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

    if (!this.shouldForceFetch && options.forceFetch) {
      options = {
        ...options,
        forceFetch: false,
      } as WatchQueryOptions;
    }

    return this.queryManager.watchQuery<T>(options);
  };

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

    // XXX what if I pass pollInterval? Will it just keep running?
    // XXX why doesn't this stop the query after it's done?

    if (!this.shouldForceFetch && options.forceFetch) {
      options = {
        ...options,
        forceFetch: false,
      } as WatchQueryOptions;
    }

    return this.queryManager.query<T>(options);
  };

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
  };

  public subscribe(options: SubscriptionOptions): Observable<any> {
    this.initStore();

    const realOptions = {
      ...options,
      document: options.query,
    };
    delete realOptions.query;

    return this.queryManager.startGraphQLSubscription(realOptions);
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
  public reducer(): Function {
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
  };

  public resetStore() {
    if (this.queryManager) {
      this.queryManager.resetStore();
    }
  };

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
    });
  };

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
      );
    }
    return this.proxy;
  }
}
