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
} from './store';

import {
  QueryManager,
  SubscriptionOptions,
} from './QueryManager';

import {
  ObservableQuery,
} from './ObservableQuery';

import {
  Observable,
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
} from './queries/getFromAST';

import isUndefined = require('lodash.isundefined');
import assign = require('lodash.assign');
import flatten = require('lodash.flatten');

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
};

export type ApolloQueryResult = {
  data: any;
  loading: boolean;

  // This type is different from the GraphQLResult type because it doesn't include errors.
  // Those are thrown via the standard promise/observer catch mechanism.
}

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
  public initialState: any;
  public queryManager: QueryManager;
  public reducerConfig: ApolloReducerConfig;
  public queryTransformer: QueryTransformer;
  public shouldBatch: boolean;
  public shouldForceFetch: boolean;
  public dataId: IdGetter;
  public fieldWithArgs: (fieldName: string, args?: Object) => string;
  public batchInterval: number;

  /**
  * Constructs an instance.
  *
  * @param networkInterface The {@link NetworkInterface} over which GraphQL documents will be sent
  * to a GraphQL spec-compliant server.
  *
  * @param reduxRootKey The root key within the Redux store in which data fetched from the server
  * will be stored.
  *
  * @param initialState The initial state assigned to the store.
  *
  * @param dataIdFromObject A function that returns a object identifier given a particular result
    object.
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
  **/
  constructor({
    networkInterface,
    reduxRootKey,
    initialState,
    dataIdFromObject,
    queryTransformer,
    shouldBatch = false,
    ssrMode = false,
    ssrForceFetchDelay = 0,
    mutationBehaviorReducers = {} as MutationBehaviorReducerMap,
    batchInterval,
  }: {
    networkInterface?: NetworkInterface,
    reduxRootKey?: string,
    initialState?: any,
    dataIdFromObject?: IdGetter,
    queryTransformer?: QueryTransformer,
    shouldBatch?: boolean,
    ssrMode?: boolean,
    ssrForceFetchDelay?: number
    mutationBehaviorReducers?: MutationBehaviorReducerMap,
    batchInterval?: number,
  } = {}) {
    this.reduxRootKey = reduxRootKey ? reduxRootKey : 'apollo';
    this.initialState = initialState ? initialState : {};
    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface('/graphql');
    this.queryTransformer = queryTransformer;
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

  public initStore() {
    if (this.store) {
      // Don't do anything if we already have a store
      return;
    }

    // If we don't have a store already, initialize a default one
    this.setStore(createApolloStore({
      reduxRootKey: this.reduxRootKey,
      initialState: this.initialState,
      config: this.reducerConfig,
    }));
  };

  public resetStore() {
    this.queryManager.resetStore();
  };

  private setStore(store: ApolloStore) {
    // ensure existing store has apolloReducer
    if (isUndefined(store.getState()[this.reduxRootKey])) {
      throw new Error(`Existing store does not use apolloReducer for ${this.reduxRootKey}`);
    }

    this.store = store;

    this.queryManager = new QueryManager({
      networkInterface: this.networkInterface,
      reduxRootKey: this.reduxRootKey,
      store,
      queryTransformer: this.queryTransformer,
      shouldBatch: this.shouldBatch,
      batchInterval: this.batchInterval,
    });
  };
}
