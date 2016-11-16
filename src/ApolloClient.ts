import {
  NetworkInterface,
  createNetworkInterface,
} from './transport/networkInterface';

import {
  // We need to import this here to allow TypeScript to include it in the definition file even
  // though we don't use it. https://github.com/Microsoft/TypeScript/issues/5711
  // We need to disable the linter here because TSLint rightfully complains that this is unused.
  /* tslint:disable */
  SelectionSet,
  /* tslint:enable */

} from 'graphql';

import isUndefined = require('lodash.isundefined');
import assign = require('lodash.assign');
import isString = require('lodash.isstring');

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
  ApolloQueryResult,
  ResultComparator,
  ResultTransformer,
} from './core/QueryManager';

import {
  ObservableQuery,
} from './core/ObservableQuery';

import {
  Observable,
} from './util/Observable';

import {
  DeprecatedWatchQueryOptions,
  DeprecatedSubscriptionOptions,
  MutationOptions,
} from './core/watchQueryOptions';

import {
  IdGetter,
} from './data/extensions';

import {
  MutationBehaviorReducerMap,
} from './data/mutationResults';

import {
  storeKeyNameFromFieldNameAndArgs,
} from './data/storeUtils';

import { createFragment } from './fragments';

import {
  addFragmentsToDocument,
} from './queries/getFromAST';

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
  public resultTransformer: ResultTransformer;
  public resultComparator: ResultComparator;
  public shouldForceFetch: boolean;
  public dataId: IdGetter;
  public fieldWithArgs: (fieldName: string, args?: Object) => string;

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
   * @param queryTransformer A function that takes a {@link SelectionSet} and modifies it in place
   * in some way. The query transformer is then applied to the every GraphQL document before it is
   * sent to the server.
   *
   * For example, a query transformer can add the __typename field to every level of a GraphQL
   * document. In fact, the @{addTypename} query transformer does exactly this.
   *
   *
   * @param ssrMode Determines whether this is being run in Server Side Rendering (SSR) mode.
   *
   * @param ssrForceFetchDelay Determines the time interval before we force fetch queries for a
   * server side render.
   *
   */
  constructor({
    networkInterface,
    reduxRootKey,
    reduxRootSelector,
    initialState,
    dataIdFromObject,
    resultTransformer,
    resultComparator,
    ssrMode = false,
    ssrForceFetchDelay = 0,
    mutationBehaviorReducers = {} as MutationBehaviorReducerMap,
    addTypename = true,
    queryTransformer,
    customResolvers,
  }: {
    networkInterface?: NetworkInterface,
    reduxRootKey?: string,
    reduxRootSelector?: string | ApolloStateSelector,
    initialState?: any,
    dataIdFromObject?: IdGetter,
    resultTransformer?: ResultTransformer,
    resultComparator?: ResultComparator,
    ssrMode?: boolean,
    ssrForceFetchDelay?: number
    mutationBehaviorReducers?: MutationBehaviorReducerMap,
    addTypename?: boolean,
    queryTransformer?: any,
    customResolvers?: CustomResolverMap,
  } = {}) {
    if (reduxRootKey && reduxRootSelector) {
      throw new Error('Both "reduxRootKey" and "reduxRootSelector" are configured, but only one of two is allowed.');
    }

    if (reduxRootKey) {
      console.warn(
          '"reduxRootKey" option is deprecated and might be removed in the upcoming versions, ' +
          'please use the "reduxRootSelector" instead.'
      );
      this.reduxRootKey = reduxRootKey;
    }

    if (queryTransformer) {
      throw new Error('queryTransformer option no longer supported in Apollo Client 0.5. ' +
        'Instead, there is a new "addTypename" option, which is on by default.');
    }

    if (!reduxRootSelector && reduxRootKey) {
      this.reduxRootSelector = (state: any) => state[reduxRootKey];
    } else if (isString(reduxRootSelector)) {
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
    this.resultTransformer = resultTransformer;
    this.resultComparator = resultComparator;
    this.shouldForceFetch = !(ssrMode || ssrForceFetchDelay > 0);
    this.dataId = dataIdFromObject;
    this.fieldWithArgs = storeKeyNameFromFieldNameAndArgs;

    if (ssrForceFetchDelay) {
      setTimeout(() => this.shouldForceFetch = true, ssrForceFetchDelay);
    }

    this.reducerConfig = {
      dataIdFromObject,
      mutationBehaviorReducers,
      customResolvers,
    };

    this.watchQuery = this.watchQuery.bind(this);
    this.query = this.query.bind(this);
    this.mutate = this.mutate.bind(this);
    this.setStore = this.setStore.bind(this);
    this.resetStore = this.resetStore.bind(this);
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
  public watchQuery(options: DeprecatedWatchQueryOptions): ObservableQuery {
    this.initStore();

    if (!this.shouldForceFetch && options.forceFetch) {
      options = assign({}, options, {
        forceFetch: false,
      }) as DeprecatedWatchQueryOptions;
    }

    // Register each of the fragments present in the query document. The point
    // is to prevent fragment name collisions with fragments that are in the query
    // document itself.
    createFragment(options.query);

    // We add the fragments to the document to pass only the document around internally.
    const fullDocument = addFragmentsToDocument(options.query, options.fragments);

    const realOptions = Object.assign({}, options, {
      query: fullDocument,
    });
    delete realOptions.fragments;

    return this.queryManager.watchQuery(realOptions);
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
  public query(options: DeprecatedWatchQueryOptions): Promise<ApolloQueryResult> {
    this.initStore();

    // XXX what if I pass pollInterval? Will it just keep running?
    // XXX why doesn't this stop the query after it's done?

    if (!this.shouldForceFetch && options.forceFetch) {
      options = assign({}, options, {
        forceFetch: false,
      }) as DeprecatedWatchQueryOptions;
    }

    // Register each of the fragments present in the query document. The point
    // is to prevent fragment name collisions with fragments that are in the query
    // document itself.
    createFragment(options.query);

    // We add the fragments to the document to pass only the document around internally.
    const fullDocument = addFragmentsToDocument(options.query, options.fragments);

    const realOptions = Object.assign({}, options, {
      query: fullDocument,
    });
    delete realOptions.fragments;

    return this.queryManager.query(realOptions);
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
   * @param options.fragments A list of fragments as returned by {@link createFragment}. These fragments
   * can be referenced from within the GraphQL mutation document.
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
  public mutate(options: MutationOptions): Promise<ApolloQueryResult> {
    this.initStore();

    // We add the fragments to the document to pass only the document around internally.
    const fullDocument = addFragmentsToDocument(options.mutation, options.fragments);

    const realOptions = Object.assign({}, options, {
      mutation: fullDocument,
    });
    delete realOptions.fragments;

    return this.queryManager.mutate(realOptions);
  };

  public subscribe(options: DeprecatedSubscriptionOptions): Observable<any> {
    this.initStore();

    // We add the fragments to the document to pass only the document around internally.
    const fullDocument = addFragmentsToDocument(options.query, options.fragments);

    const realOptions = Object.assign({}, options, {
      document: fullDocument,
    });
    delete realOptions.fragments;
    delete realOptions.query;

    return this.queryManager.startGraphQLSubscription(realOptions);
  }

  /**
   * Returns a reducer function configured according to the `reducerConfig` instance variable.
   */
  public reducer(): Function {
    return createApolloReducer(this.reducerConfig);
  }

  public middleware = () => {
    return (store: ApolloStore) => {
      this.setStore(store);

      return (next: any) => (action: any) => {
        const returnValue = next(action);
        this.queryManager.broadcastNewStore(store.getState());
        return returnValue;
      };
    };
  };

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
          `Please remove that option from ApolloClient constructor.`
      );
    }

    // If we don't have a store already, initialize a default one
    this.setStore(createApolloStore({
      reduxRootKey: DEFAULT_REDUX_ROOT_KEY,
      initialState: this.initialState,
      config: this.reducerConfig,
    }));
    // for backcompatibility, ensure that reduxRootKey is set to selector return value
    this.reduxRootKey = DEFAULT_REDUX_ROOT_KEY;
  };

  public resetStore() {
    this.queryManager.resetStore();
  };

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
    if (isUndefined(reduxRootSelector(store.getState()))) {
      throw new Error(
          'Existing store does not use apolloReducer. Please make sure the store ' +
          'is properly configured and "reduxRootSelector" is correctly specified.'
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
    });
  };
}
