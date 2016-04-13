import {
  NetworkInterface,
  createNetworkInterface,
} from './networkInterface';

import {
  GraphQLResult,
} from 'graphql';

import {
  createApolloStore,
  ApolloStore,
  apolloReducer,
} from './store';

import {
  QueryManager,
  WatchedQueryHandle,
  WatchQueryOptions,
} from './QueryManager';

import {
  isUndefined,
} from 'lodash';

export {
  createNetworkInterface,
  createApolloStore,
  apolloReducer,
};

export default class ApolloClient {
  public networkInterface: NetworkInterface;
  public store: ApolloStore;
  public reduxRootKey: string;
  public queryManager: QueryManager;

  constructor({
    networkInterface,
    reduxRootKey,
  }: {
    networkInterface?: NetworkInterface,
    reduxRootKey?: string,
  } = {}) {
    this.reduxRootKey = reduxRootKey ? reduxRootKey : 'apollo';

    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface('/graphql');
  }

  public watchQuery(options: WatchQueryOptions): WatchedQueryHandle {
    this.initStore();

    return this.queryManager.watchQuery(options);
  }

  public query(options: WatchQueryOptions): Promise<GraphQLResult | Error> {

    if (options.returnPartialData) {
      throw new Error('returnPartialData option only supported on watchQuery.');
    }

    this.initStore();


    return new Promise((resolve, reject) => {
      const handle = this.queryManager.watchQuery(options);
      handle.onResult((result) => {
        resolve(result);
        // remove the listeners
        handle.stop();
      });
    });
  }

  public mutate(options: {
    mutation: string,
    variables?: Object,
  }): Promise<GraphQLResult> {
    this.initStore();
    return this.queryManager.mutate(options);
  }

  public reducer() {
    return apolloReducer;
  }

  public middleware() {
    return (store: ApolloStore) => {
      this.setStore(store);

      // Pass through. Eventually we should use this instead of subscribe, and get rid of setStore
      return next => (action) => {
        if (action.isApolloAction) {
          const returnValue = next(action);
          this.queryManager.broadcastNewStore(store.getState());
          return returnValue;
        }

        return next(action);
      };
    };
  }

  public initStore() {
    if (this.store) {
      // Don't do anything if we already have a store
      return;
    }

    // If we don't have a store already, initialize a default one
    this.setStore(createApolloStore(this.reduxRootKey));
  }

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
    });
  }
}
