import {
  SelectionSet,
  GraphQLError,
} from 'graphql';

import {
  Store,
} from './store';

import {
  forOwn,
} from 'lodash';

import {
  readSelectionSetFromStore,
} from './readFromStore';

export class WatchedQueries {
  private selectionSetMap: { [queryId: number]: SelectionSetWithRoot };
  private callbacks: { [queryId: number]: QueryStateChangeCallback[]};
  private idCounter = 0;

  constructor() {
    this.selectionSetMap = {};
    this.callbacks = {};
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

  public broadcastNewStore(store: Store) {
    forOwn(this.selectionSetMap, (selectionSetWithRoot: SelectionSetWithRoot, queryId: string) => {
      const resultFromStore = readSelectionSetFromStore({
        store,
        rootId: selectionSetWithRoot.rootId,
        selectionSet: selectionSetWithRoot.selectionSet,
      });

      this.broadcastQueryChange(queryId, null, resultFromStore);
    });
  }

  private broadcastQueryChange(queryId: string, error: GraphQLError, result: any) {
    this.callbacks[queryId].forEach((callback) => {
      callback(error, result);
    });
  }

  private registerQueryCallback(queryId: string, callback: QueryStateChangeCallback): void {
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
  onData(callback: QueryStateChangeCallback);
}

export type QueryStateChangeCallback = (error: GraphQLError, result: any) => void;
