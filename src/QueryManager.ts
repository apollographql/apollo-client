/// <reference path="../typings/main.d.ts" />

import {
  NetworkInterface,
  Request,
} from './networkInterface';

import {
  parseQueryIfString,
} from './parser';

import {
  assign,
} from 'lodash';

import {
  createQueryResultAction,
  Store,
} from './store';

import {
  Store as ReduxStore,
} from 'redux';

import {
  SelectionSet,
} from 'graphql';

import {
  forOwn,
} from 'lodash';

import {
  readSelectionSetFromStore,
} from './readFromStore';

export class QueryManager {
  private networkInterface: NetworkInterface;
  private store: ReduxStore;
  private selectionSetMap: { [queryId: number]: SelectionSetWithRoot };
  private callbacks: { [queryId: number]: QueryResultCallback[]};
  private idCounter = 0;

  constructor({
    networkInterface,
    store,
  }: {
    networkInterface: NetworkInterface,
    store: ReduxStore,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;

    this.selectionSetMap = {};
    this.callbacks = {};

    this.store.subscribe((data) => {
      this.broadcastNewStore(data);
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

    const watchHandle = this.watchSelectionSet({
      selectionSet: queryDef.selectionSet,
      rootId: 'ROOT_QUERY',
      typeName: 'Query',
    });

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

    return watchHandle;
  }

  public broadcastNewStore(store: Store) {
    forOwn(this.selectionSetMap, (selectionSetWithRoot: SelectionSetWithRoot, queryId: string) => {
      const resultFromStore = readSelectionSetFromStore({
        store,
        rootId: selectionSetWithRoot.rootId,
        selectionSet: selectionSetWithRoot.selectionSet,
      });

      this.broadcastQueryChange(queryId, resultFromStore);
    });
  }

  public watchSelectionSet(selectionSetWithRoot: SelectionSetWithRoot): WatchedQueryHandle {
    const queryId = this.idCounter.toString();
    this.idCounter++;

    this.selectionSetMap[queryId] = selectionSetWithRoot;

    return {
      stop: () => {
        throw new Error('Not implemented');
      },
      onData: (callback) => {
        this.registerQueryCallback(queryId, callback);
      },
    };
  }

  private broadcastQueryChange(queryId: string, result: any) {
    this.callbacks[queryId].forEach((callback) => {
      callback(result);
    });
  }

  private registerQueryCallback(queryId: string, callback: QueryResultCallback): void {
    if (! this.callbacks[queryId]) {
      this.callbacks[queryId] = [];
    }

    this.callbacks[queryId].push(callback);
  }
}

export interface SelectionSetWithRoot {
  rootId: string;
  typeName: string;
  selectionSet: SelectionSet;
}

export interface WatchedQueryHandle {
  stop();
  onData(callback: QueryResultCallback);
}

export type QueryResultCallback = (result: any) => void;
