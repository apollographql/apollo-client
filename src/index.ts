import {
  NetworkInterface,
  createNetworkInterface,
  addQueryMerging,
} from './networkInterface';

import {
  Document,
  FragmentDefinition,

  // We need to import this here to allow TypeScript to include it in the definition file even
  // though we don't use it. https://github.com/Microsoft/TypeScript/issues/5711
  // We need to disable the linter here because TSLint rightfully complains that this is unused.
  /* tslint:disable */
  SelectionSet,
  /* tslint:enable */

} from 'graphql';

import {
  print,
} from 'graphql-tag/printer';

import {
  createApolloStore,
  ApolloStore,
  createApolloReducer,
  ApolloReducerConfig,
  Store,
} from './store';

import {
  QueryManager,
  SubscriptionOptions,
  ResultComparator,
  ResultTransformer,
} from './QueryManager';

import {
  ObservableQuery,
} from './ObservableQuery';

import {
  Observable,
  Subscription,
} from './util/Observable';

import {
  WatchQueryOptions,
} from './watchQueryOptions';

import {
  readQueryFromStore,
  readFragmentFromStore,
} from './data/readFromStore';

import {
  writeQueryToStore,
  writeFragmentToStore,
} from './data/writeToStore';

import {
  IdGetter,
} from './data/extensions';

import {
  QueryTransformer,
  addTypenameToSelectionSet,
} from './queries/queryTransform';

import {
  MutationBehavior,
  MutationBehaviorReducerMap,
  MutationQueryReducersMap,
} from './data/mutationResults';

import {
  storeKeyNameFromFieldNameAndArgs,
} from './data/storeUtils';

import {
  getFragmentDefinitions,
  createFragmentMap,
} from './queries/getFromAST';

import {
  ApolloError,
} from './errors';

import isUndefined = require('lodash.isundefined');
import assign = require('lodash.assign');
import flatten = require('lodash.flatten');
import isString = require('lodash.isstring');

// We expose the print method from GraphQL so that people that implement
// custom network interfaces can turn query ASTs into query strings as needed.
export {
  createNetworkInterface,
  addQueryMerging,
  createApolloStore,
  createApolloReducer,
  readQueryFromStore,
  readFragmentFromStore,
  addTypenameToSelectionSet as addTypename,
  writeQueryToStore,
  writeFragmentToStore,
  print as printAST,
  createFragmentMap,
  ApolloError,

  // internal type definitions for export
  WatchQueryOptions,
  ObservableQuery,
  MutationBehavior,
  MutationQueryReducersMap,
  Subscription,
  ApolloStore,
};

export type ApolloQueryResult = {
  data: any;
  loading: boolean;

  // This type is different from the GraphQLResult type because it doesn't include errors.
  // Those are thrown via the standard promise/observer catch mechanism.
}

/**
 * This type defines a "selector" function that receives state from the Redux store
 * and returns the part of it that is managed by ApolloClient
 * @param state State of a Redux store
 * @returns {Store} Part of state managed by ApolloClient
 */
export type ApolloStateSelector = (state: any) => Store;

const DEFAULT_REDUX_ROOT_KEY = 'apollo';

// A map going from the name of a fragment to that fragment's definition.
// The point is to keep track of fragments that exist and print a warning if we encounter two
// fragments that have the same name, i.e. the values *should* be of arrays of length 1.
// Note: this variable is exported solely for unit testing purposes. It should not be touched
// directly by application code.
export let fragmentDefinitionsMap: { [fragmentName: string]: FragmentDefinition[] } = {};

// Specifies whether or not we should print warnings about conflicting fragment names.
let printFragmentWarnings = true;

// Takes a document, extracts the FragmentDefinitions from it and puts
// them in this.fragmentDefinitions. The second argument specifies the fragments
// that the fragment in the document depends on. The fragment definition array from the document
// is concatenated with the fragment definition array passed as the second argument and this
// concatenated array is returned.
export function createFragment(
  doc: Document,
  fragments: (FragmentDefinition[] | FragmentDefinition[][]) = []
): FragmentDefinition[] {
  fragments = flatten(fragments) as FragmentDefinition[] ;
  const fragmentDefinitions = getFragmentDefinitions(doc);
  fragmentDefinitions.forEach((fragmentDefinition) => {
    const fragmentName = fragmentDefinition.name.value;
    if (fragmentDefinitionsMap.hasOwnProperty(fragmentName) &&
        fragmentDefinitionsMap[fragmentName].indexOf(fragmentDefinition) === -1) {
      // this is a problem because the app developer is trying to register another fragment with
      // the same name as one previously registered. So, we tell them about it.
      if (printFragmentWarnings) {
        console.warn(`Warning: fragment with name ${fragmentDefinition.name.value} already exists.
Apollo Client enforces all fragment names across your application to be unique; read more about
this in the docs: http://docs.apollostack.com/`);
      }

      fragmentDefinitionsMap[fragmentName].push(fragmentDefinition);
    } else if (!fragmentDefinitionsMap.hasOwnProperty(fragmentName)) {
      fragmentDefinitionsMap[fragmentName] = [fragmentDefinition];
    }
  });

  return fragments.concat(fragmentDefinitions);
}

// This function disables the warnings printed about fragment names. One place where this chould be
// called is within writing unit tests that depend on Apollo Client and use named fragments that may
// have the same name across different unit tests.
export function disableFragmentWarnings() {
  printFragmentWarnings = false;
}

export function enableFragmentWarnings() {
  printFragmentWarnings = true;
}

// This function is used to be empty the namespace of fragment definitions. Used for unit tests.
export function clearFragmentDefinitions() {
  fragmentDefinitionsMap = {};
}

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
  public queryTransformer: QueryTransformer;
  public resultTransformer: ResultTransformer;
  public resultComparator: ResultComparator;
  public shouldBatch: boolean;
  public shouldForceFetch: boolean;
  public dataId: IdGetter;
  public fieldWithArgs: (fieldName: string, args?: Object) => string;
  public batchInterval: number;

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
   * @param shouldBatch Determines whether multiple queries should be batched together in a single
   * roundtrip.
   * <p />
   *
   * Note that if this is set to true, the [[NetworkInterface]] should implement
   * [[BatchedNetworkInterface]]. Every time a query is fetched, it is placed into the queue of
   * the batcher. At the end of each batcher time interval, the query batcher batches together
   * (if shouldBatch is true) each of the queries in the queue and sends them to the server.
   * This happens transparently: each query will still receive exactly the result it asked for,
   * regardless of whether or not it is batched.
   *
   * @param ssrMode Determines whether this is being run in Server Side Rendering (SSR) mode.
   *
   * @param ssrForceFetchDelay Determines the time interval before we force fetch queries for a
   * server side render.
   *
   * @param batchInterval The time interval on which the query batcher operates.
   */
  constructor({
    networkInterface,
    reduxRootKey,
    reduxRootSelector,
    initialState,
    dataIdFromObject,
    queryTransformer,
    resultTransformer,
    resultComparator,
    shouldBatch = false,
    ssrMode = false,
    ssrForceFetchDelay = 0,
    mutationBehaviorReducers = {} as MutationBehaviorReducerMap,
    batchInterval,
  }: {
    networkInterface?: NetworkInterface,
    reduxRootKey?: string,
    reduxRootSelector?: string | ApolloStateSelector,
    initialState?: any,
    dataIdFromObject?: IdGetter,
    queryTransformer?: QueryTransformer,
    resultTransformer?: ResultTransformer,
    resultComparator?: ResultComparator,
    shouldBatch?: boolean,
    ssrMode?: boolean,
    ssrForceFetchDelay?: number
    mutationBehaviorReducers?: MutationBehaviorReducerMap,
    batchInterval?: number,
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
      createNetworkInterface('/graphql');
    this.queryTransformer = queryTransformer;
    this.resultTransformer = resultTransformer;
    this.resultComparator = resultComparator;
    this.shouldBatch = shouldBatch;
    this.shouldForceFetch = !(ssrMode || ssrForceFetchDelay > 0);
    this.dataId = dataIdFromObject;
    this.fieldWithArgs = storeKeyNameFromFieldNameAndArgs;
    this.batchInterval = batchInterval;

    if (ssrForceFetchDelay) {
      setTimeout(() => this.shouldForceFetch = true, ssrForceFetchDelay);
    }

    this.reducerConfig = {
      dataIdFromObject,
      mutationBehaviorReducers,
    };

    this.watchQuery = this.watchQuery.bind(this);
    this.query = this.query.bind(this);
    this.mutate = this.mutate.bind(this);
    this.setStore = this.setStore.bind(this);
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
  public watchQuery(options: WatchQueryOptions): ObservableQuery {
    this.initStore();

    if (!this.shouldForceFetch && options.forceFetch) {
      options = assign({}, options, {
        forceFetch: false,
      }) as WatchQueryOptions;
    }

    // Register each of the fragments present in the query document. The point
    // is to prevent fragment name collisions with fragments that are in the query
    // document itself.
    createFragment(options.query);

    return this.queryManager.watchQuery(options);
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
  public query(options: WatchQueryOptions): Promise<ApolloQueryResult> {
    this.initStore();

    if (!this.shouldForceFetch && options.forceFetch) {
      options = assign({}, options, {
        forceFetch: false,
      }) as WatchQueryOptions;
    }

    // Register each of the fragments present in the query document. The point
    // is to prevent fragment name collisions with fragments that are in the query
    // document itself.
    createFragment(options.query);

    return this.queryManager.query(options);
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
  public mutate(options: {
    mutation: Document,
    variables?: Object,
    resultBehaviors?: MutationBehavior[],
    fragments?: FragmentDefinition[],
    optimisticResponse?: Object,
    updateQueries?: MutationQueryReducersMap,
    refetchQueries?: string[],
  }): Promise<ApolloQueryResult> {
    this.initStore();
    return this.queryManager.mutate(options);
  };

  public subscribe(options: SubscriptionOptions): Observable<any> {
    this.initStore();
    return this.queryManager.startGraphQLSubscription(options);
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
      queryTransformer: this.queryTransformer,
      resultTransformer: this.resultTransformer,
      resultComparator: this.resultComparator,
      shouldBatch: this.shouldBatch,
      batchInterval: this.batchInterval,
    });
  };
}
