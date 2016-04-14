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
  WatchQueryOptions,
} from './QueryManager';

import ObservableQuery from './queries/ObservableQuery';

import {
  isUndefined,
} from 'lodash';


export default class ApolloClient {
  public networkInterface: NetworkInterface;
  public store: ApolloStore;
  public reduxRootKey: string;
  public queryManager: QueryManager;

  constructor({
    networkInterface,
    store,
    reduxRootKey,
  }: {
    networkInterface?: NetworkInterface,
    store?: ApolloStore,
    reduxRootKey?: string,
  } = {}) {
    this.reduxRootKey = reduxRootKey ? reduxRootKey : 'apollo';

    this.networkInterface = networkInterface ? networkInterface :
      createNetworkInterface('/graphql');

    // ensure existing store has apolloReducer
    if (store &&
       isUndefined(store.getState()[this.reduxRootKey])) {
      throw new Error(
        `Existing store does not use apolloReducer for ${this.reduxRootKey}`
      );
    }

    this.store = store ?
      store :
      createApolloStore(this.reduxRootKey);

    this.queryManager = new QueryManager({
      networkInterface: this.networkInterface,
      store: this.store,
      reduxRootKey: this.reduxRootKey,
    });
  }

  public watchQuery(options: WatchQueryOptions): ObservableQuery {
    return this.queryManager.watchQuery(options);
  }

  public query(options: WatchQueryOptions): Promise<GraphQLResult> {
    return this.queryManager.query(options);
  }

  public mutate(options: {
    mutation: string,
    variables?: Object,
  }): Promise<GraphQLResult> {
    return this.queryManager.mutate(options);
  }
}
