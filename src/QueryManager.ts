/// <reference path="../typings/main.d.ts" />

import {
  NetworkInterface,
  Request,
} from './networkInterface';

import {
  QueryDisperser,
  WatchedQueryHandle,
} from './QueryDisperser';

import {
  parseQueryIfString,
} from './parser';

import {
  Store,
} from 'redux';

import {
  assign,
} from 'lodash';

import {
  createQueryResultAction,
} from './store';

export class QueryManager {
  private networkInterface: NetworkInterface;
  private queryDisperser: QueryDisperser;
  private store: Store;

  constructor({
    networkInterface,
    store,
  }: {
    networkInterface: NetworkInterface,
    store: Store,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;

    this.queryDisperser = new QueryDisperser();

    this.store.subscribe((data) => {
      this.queryDisperser.broadcastNewStore(data);
    });
  }

  public watchQuery({
     query,
  }: {
    query: string,
  }): WatchedQueryHandle {
    const queryDef = parseQueryIfString(query);

    const request = {
      query: query,
    } as Request;

    this.networkInterface.query([
      request,
    ]).then((result) => {
      const resultWithDataId = assign({
        __data_id: 'ROOT_QUERY',
      }, result[0].data);

      this.store.dispatch(createQueryResultAction({
        result: resultWithDataId,
        selectionSet: queryDef.selectionSet,
      }));
    }).catch((error) => {
      // nothing
    });

    return this.queryDisperser.watchSelectionSet({
      selectionSet: queryDef.selectionSet,
      rootId: 'ROOT_QUERY',
      typeName: 'Query',
    });
  }
}
