import {
  NetworkInterface,
  createNetworkInterface,
} from './networkInterface';

import {
  GraphQLResult,
  Document,
  FragmentDefinition,
} from 'graphql';

import {
  print,
} from 'graphql/language/printer';

import {
  createApolloStore,
  ApolloStore,
  createApolloReducer,
  ApolloReducerConfig,
} from './store';

import {
  QueryManager,
  WatchQueryOptions,
  ObservableQuery,
} from './QueryManager';

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
} from './data/mutationResults';

import {
  storeKeyNameFromFieldNameAndArgs,
} from './data/storeUtils';

import {
  getFragmentDefinitions,
} from './queries/getFromAST';

import isUndefined = require('lodash.isundefined');
import assign = require('lodash.assign');

// We expose the print method from GraphQL so that people that implement
// custom network interfaces can turn query ASTs into query strings as needed.
export {
  createNetworkInterface,
  createApolloStore,
  createApolloReducer,
  readQueryFromStore,
  readFragmentFromStore,
  addTypenameToSelectionSet as addTypename,
  writeQueryToStore,
  writeFragmentToStore,
  print as printAST,
};

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

  // A map going from the name of a fragment to that fragment's definition.
  // The method fragment adds fragments to this map. The point is to keep track
  // of fragments that exist and print a warning if we encounter two fragments
  // that have the same name, i.e. the values *should* be of length 1.
  private fragmentDefinitions: { [fragmentName: string]: FragmentDefinition[] }

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

    if (ssrForceFetchDelay) {
      setTimeout(() => this.shouldForceFetch = true, ssrForceFetchDelay);
    }

    this.reducerConfig = {
      dataIdFromObject,
      mutationBehaviorReducers,
    };
  }

  public watchQuery = (options: WatchQueryOptions): ObservableQuery => {
    this.initStore();

    if (!this.shouldForceFetch && options.forceFetch) {
      options = assign({}, options, {
        forceFetch: false,
      }) as WatchQueryOptions;
    }

    return this.queryManager.watchQuery(options);
  };

  public query = (options: WatchQueryOptions): Promise<GraphQLResult> => {
    this.initStore();

    if (!this.shouldForceFetch && options.forceFetch) {
      options = assign({}, options, {
        forceFetch: false,
      }) as WatchQueryOptions;
    }

    return this.queryManager.query(options);
  };

  public mutate = (options: {
    mutation: Document,
    resultBehaviors?: MutationBehavior[],
    variables?: Object,
  }): Promise<GraphQLResult> => {
    this.initStore();
    return this.queryManager.mutate(options);
  };

  public reducer(): Function {
    return createApolloReducer(this.reducerConfig);
  }

  public middleware = () => {
    return (store: ApolloStore) => {
      this.setStore(store);

      return (next) => (action) => {
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

  // Takes a document, extracts the FragmentDefinitions from it and puts
  // them in this.fragmentDefinitions.
  public fragment(doc: Document) {
    const fragmentDefinitions = getFragmentDefinitions(doc);
    fragmentDefinitions.forEach((fragmentDefinition) => {
      const fragmentName = fragmentDefinition.name.value;
      if(this.fragmentDefinitions.hasOwnProperty(fragmentName)) {
        // this is a problem because the app developer is trying to register another fragment with
        // the same name as one previously registered. So, we tell them about it.
        console.warn(`Warning: fragment with name ${fragmentDefinition.name.value} already exists.`);
        this.fragmentDefinitions[fragmentName].push(fragmentDefinition);
      } else {
        this.fragmentDefinitions[fragmentName] = [fragmentDefinition];
      }
    });
  }

  private setStore = (store: ApolloStore) => {
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
    });
  };
}
