import {
  NetworkInterface,
  createNetworkInterface,
} from './networkInterface';

import {
  Store,
} from 'redux';

import {
  GraphQLResult,
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

  public query(options: WatchQueryOptions): Promise<GraphQLResult | Error> {
    return new Promise((resolve, reject) => {
      const handle = this.queryManager.watchQuery(options);
      handle.onResult((err, data) => {
        let response: GraphQLResult = {};

        if (err) {
          response.errors = err;
        }

        // XXX support both errors and data
        // currently the query manager stops execution on an error
        // once that is refactored, the response can return both data and errors
        if (data) {
          response.data = data;
        }

        resolve(response);
        // remove the listeners
        handle.stop();
      });
    });
  }
}
