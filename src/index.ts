import {
  NetworkInterface,
  createNetworkInterface,
} from './networkInterface';

import {
  Store,
} from 'redux';

import {
  GraphQLError,
} from 'graphql';

import {
  createApolloStore,
} from './store';

import {
  QueryManager,
  WatchedQueryHandle,
  WatchQueryOptions,
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
  } = {}) {
    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface('/graphql');

    this.apolloStore = apolloStore ? apolloStore : createApolloStore();

    this.queryManager = new QueryManager({
      networkInterface: this.networkInterface,
      store: this.apolloStore,
    });
  }

  public watchQuery(options: WatchQueryOptions): WatchedQueryHandle {
    return this.queryManager.watchQuery(options);
  }

  public query(options: WatchQueryOptions): Promise<GraphQLError[] | any> {
    return new Promise((resolve, reject) => {
      const handle = this.watchQuery(options);

      handle.onResult((err, result) => {
        if (err) {
          reject(err as GraphQLError[]);
        } else {
          resolve(result as any);
        }
        // remove the listeners
        handle.stop();
      });
    })

  }
}
