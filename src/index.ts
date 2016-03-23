import {
  NetworkInterface,
  createNetworkInterface,
} from './networkInterface';

import {
  Store,
} from 'redux';

import {
  createApolloStore,
} from './store';

import {
  QueryManager,
  WatchedQueryHandle,
} from './QueryManager';

export class ApolloClient {
  public networkInterface: NetworkInterface;
  public apolloStore: Store;
  public queryManager: QueryManager;

  constructor({
    networkInterface,
    apolloStore,
  }: {
    networkInterface?: NetworkInterface,
    apolloStore?: Store,
  }) {
    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface('/graphql');

    this.apolloStore = apolloStore ? apolloStore : createApolloStore();

    this.queryManager = new QueryManager({
      networkInterface: this.networkInterface,
      store: this.apolloStore,
    });
  }

  public watchQuery({
    query,
  }: {
    query: string,
  }): WatchedQueryHandle {
    return this.queryManager.watchQuery({ query });
  }
}
