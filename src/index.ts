import {
  NetworkInterface,
  createNetworkInterface,
} from './networkInterface';

import {
  GraphQLResult,
  Document,
} from 'graphql';

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
  IdGetter,
} from './data/extensions';

import isUndefined = require('lodash.isundefined');

export {
  createNetworkInterface,
  createApolloStore,
  createApolloReducer,
  readQueryFromStore,
  readFragmentFromStore,
};

export default class ApolloClient {
  public networkInterface: NetworkInterface;
  public store: ApolloStore;
  public reduxRootKey: string;
  public initialState: any;
  public queryManager: QueryManager;
  public reducerConfig: ApolloReducerConfig;

  constructor({
    networkInterface,
    reduxRootKey,
    initialState,
    dataIdFromObject,
  }: {
    networkInterface?: NetworkInterface,
    reduxRootKey?: string,
    initialState?: any,
    dataIdFromObject?: IdGetter,
  } = {}) {
    this.reduxRootKey = reduxRootKey ? reduxRootKey : 'apollo';
    this.initialState = initialState ? initialState : {};
    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface('/graphql');

    this.reducerConfig = {
      dataIdFromObject,
    };
  }

  public watchQuery = (options: WatchQueryOptions): ObservableQuery => {
    this.initStore();

    return this.queryManager.watchQuery(options);
  };

  public query = (options: WatchQueryOptions): Promise<GraphQLResult> => {
    this.initStore();

    return this.queryManager.query(options);
  };

  public mutate = (options: {
    mutation: Document,
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
    });
  };
}
