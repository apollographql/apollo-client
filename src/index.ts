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
} from './QueryManager';

import {
    ObservableQuery,
} from './ObservableQuery';

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
  // Right now only has one property, but will later include loading state, and possibly other info
  // This is different from the GraphQLResult type because it doesn't include errors - those are
  // thrown via the standard promise/observer catch mechanism
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
export function createFragment(doc: Document, fragments: FragmentDefinition[] = []): FragmentDefinition[] {
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
  }

  public watchQuery = (options: WatchQueryOptions): ObservableQuery => {
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

  public query = (options: WatchQueryOptions): Promise<ApolloQueryResult> => {
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

  public mutate = (options: {
    mutation: Document,
    variables?: Object,
    resultBehaviors?: MutationBehavior[],
    fragments?: FragmentDefinition[],
    optimisticResponse?: Object,
    updateQueries?: MutationQueryReducersMap,
  }): Promise<ApolloQueryResult> => {
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
      batchInterval: this.batchInterval,
    });
  };
}
