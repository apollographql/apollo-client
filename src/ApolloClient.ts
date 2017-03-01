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
  ResultComparator,
  ResultTransformer,
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
  ReduxDataProxy,
  TransactionDataProxy,
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
export default class ApolloClient {
  public networkInterface: NetworkInterface;
  public store: ApolloStore;
  public reduxRootKey: string;
  public reduxRootSelector: ApolloStateSelector | null;
  public initialState: any;
  public queryManager: QueryManager;
  public reducerConfig: ApolloReducerConfig;
  public addTypename: boolean;
  public resultTransformer: ResultTransformer | undefined;
  public resultComparator: ResultComparator | undefined;
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
   * @deprecated please use "reduxRootSelector" instead
   * @param reduxRootKey The root key within the Redux store in which data fetched from the server.
   * will be stored. This option should only be used if the store is created outside of the client.
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
   * @param queryDeduplication If set to true, a query will not be sent to the server if a query
   * with identical parameters (query, variables, operationName) is already in flight.
   *
   */

  constructor(options: {
    networkInterface?: NetworkInterface,
    reduxRootKey?: string,
    reduxRootSelector?: string | ApolloStateSelector,
    initialState?: any,
    dataIdFromObject?: IdGetter,
    resultTransformer?: ResultTransformer,
    resultComparator?: ResultComparator,
    ssrMode?: boolean,
    ssrForceFetchDelay?: number
    addTypename?: boolean,
    customResolvers?: CustomResolverMap,
    connectToDevTools?: boolean,
    queryDeduplication?: boolean,
  } = {}) {
    const {
      networkInterface,
      reduxRootKey,
      reduxRootSelector,
      initialState,
      dataIdFromObject,
      resultComparator,
      ssrMode = false,
      ssrForceFetchDelay = 0,
      addTypename = true,
      resultTransformer,
      customResolvers,
      connectToDevTools,
      queryDeduplication = false,
    } = options;
    if (reduxRootKey && reduxRootSelector) {
      throw new Error('Both "reduxRootKey" and "reduxRootSelector" are configured, but only one of two is allowed.');
    }

    if (reduxRootKey) {
      console.warn(
          '"reduxRootKey" option is deprecated and might be removed in the upcoming versions, ' +
          'please use the "reduxRootSelector" instead.',
      );
      this.reduxRootKey = reduxRootKey;
    }

    if (!reduxRootSelector && reduxRootKey) {
      this.reduxRootSelector = (state: any) => state[reduxRootKey];
    } else if (typeof reduxRootSelector === 'string') {
      // for backwards compatibility, we set reduxRootKey if reduxRootSelector is a string
      this.reduxRootKey = reduxRootSelector as string;
      this.reduxRootSelector = (state: any) => state[reduxRootSelector as string];
    } else if (typeof reduxRootSelector === 'function') {
      this.reduxRootSelector = reduxRootSelector;
    } else {
      // we need to know that reduxRootSelector wasn't provided by the user
      this.reduxRootSelector = null;
    }

    this.initialState = initialState ? initialState : {};
    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface({ uri: '/graphql' });
    this.addTypename = addTypename;
    if (resultTransformer) {
      console.warn(
        '"resultTransformer" is being considered for deprecation in an upcoming version. ' +
        'If you are using it, please file an issue on apollostack/apollo-client ' +
        'with a description of your use-case',
      );
    }
    this.resultTransformer = resultTransformer;
    this.resultComparator = resultComparator;
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
   *
   * @param options.mutation A GraphQL document, often created with `gql` from the `graphql-tag` package,
   * that contains a single mutation inside of it.
   *
   * @param options.variables An object that maps from the name of a variable as used in the mutation
   * GraphQL document to that variable's value.
   *
   * @param options.optimisticResponse An object that represents the result of this mutation that will be
   * optimistically stored before the server has actually returned a result. This is most often
   * used for optimistic UI, where we want to be able to see the result of a mutation immediately,
   * and update the UI later if any errors appear.
   *
   * @param options.updateQueries A {@link MutationQueryReducersMap}, which is map from query names to
   * mutation query reducers. Briefly, this map defines how to incorporate the results of the
   * mutation into the results of queries that are currently being watched by your application.
   *
   * @param options.refetchQueries A list of query names which will be refetched once this mutation has
   * returned. This is often used if you have a set of queries which may be affected by a mutation
   * and will have to update. Rather than writing a mutation query reducer (i.e. `updateQueries`)
   * for this, you can simply refetch the queries that will be affected and achieve a consistent
   * store once these queries return.
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
   *
   * @param query The GraphQL query shape to be used.
   *
   * @param variables Any variables that the GraphQL query may depend on.
   */
  public readQuery<QueryType>(config: {
    query: DocumentNode,
    variables?: Object,
  }): QueryType {
    return this.initProxy().readQuery<QueryType>(config);
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
   * @param id The root id to be used. This id should take the same form as the
   * value returned by your `dataIdFromObject` function. If a value with your
   * id does not exist in the store, `null` will be returned.
   *
   * @param fragment A GraphQL document with one or more fragments the shape of
   * which will be used. If you provide more then one fragments then you must
   * also specify the next argument, `fragmentName`, to select a single
   * fragment to use when reading.
   *
   * @param fragmentName The name of the fragment in your GraphQL document to
   * be used. Pass `undefined` if there is only one fragment and you want to
   * use that.
   *
   * @param variables Any variables that your GraphQL fragments depend on.
   */
  public readFragment<FragmentType>(config: {
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  }): FragmentType | null {
    return this.initProxy().readFragment<FragmentType>(config);
  }

  /**
   * Writes some data in the shape of the provided GraphQL query directly to
   * the store. This method will start at the root query. To start at a a
   * specific id returned by `dataIdFromObject` then use `writeFragment`.
   *
   * @param data The data you will be writing to the store.
   *
   * @param query The GraphQL query shape to be used.
   *
   * @param variables Any variables that the GraphQL query may depend on.
   */
  public writeQuery(config: {
    data: any,
    query: DocumentNode,
    variables?: Object,
  }): void {
    return this.initProxy().writeQuery(config);
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
   *
   * @param data The data you will be writing to the store.
   *
   * @param id The root id to be used. This id should take the same form as the
   * value returned by your `dataIdFromObject` function.
   *
   * @param fragment A GraphQL document with one or more fragments the shape of
   * which will be used. If you provide more then one fragments then you must
   * also specify the next argument, `fragmentName`, to select a single
   * fragment to use when reading.
   *
   * @param fragmentName The name of the fragment in your GraphQL document to
   * be used. Pass `undefined` if there is only one fragment and you want to
   * use that.
   *
   * @param variables Any variables that your GraphQL fragments depend on.
   */
  public writeFragment(config: {
    data: any,
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  }): void {
    return this.initProxy().writeFragment(config);
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
          'Cannot initialize the store because "reduxRootSelector" or "reduxRootKey" is provided. ' +
          'They should only be used when the store is created outside of the client. ' +
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
    // for backcompatibility, ensure that reduxRootKey is set to selector return value
    this.reduxRootKey = DEFAULT_REDUX_ROOT_KEY;
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

      // for backwards compatibility with react-apollo, we set reduxRootKey here.
      this.reduxRootKey = DEFAULT_REDUX_ROOT_KEY;
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
      resultTransformer: this.resultTransformer,
      resultComparator: this.resultComparator,
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
