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
} from './store';

import {
  QueryManager,
  WatchedQueryHandle,
  WatchQueryOptions,
} from './QueryManager';

import {
  isUndefined,
} from 'lodash';


export class ApolloClient {
  public networkInterface: NetworkInterface;
  public apolloStore: ApolloStore;
  public apolloRootKey: string;
  public queryManager: QueryManager;

  constructor({
    networkInterface,
    apolloStore,
    apolloRootKey,
  }: {
    networkInterface?: NetworkInterface,
    apolloStore?: ApolloStore,
    apolloRootKey?: string,
  } = {}) {
    this.apolloRootKey = apolloRootKey ? apolloRootKey : 'apollo';

    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface('/graphql');

    // ensure existing store has apolloReducer
    if (apolloStore &&
       isUndefined(apolloStore.getState()[this.apolloRootKey])) {
      throw new Error(
        `Existing store does not use apolloReducer for ${this.apolloRootKey}`
      );
    }

    this.apolloStore = apolloStore ?
      apolloStore :
      createApolloStore(this.apolloRootKey);

    this.queryManager = new QueryManager({
      networkInterface: this.networkInterface,
      store: this.apolloStore,
      apolloRootKey: this.apolloRootKey,
    });
  }

  public watchQuery(options: WatchQueryOptions): WatchedQueryHandle {
    return this.queryManager.watchQuery(options);
  }

  public query(options: WatchQueryOptions): Promise<GraphQLResult | Error> {
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
    return this.queryManager.mutate(options);
  }
}
