/// <reference path="../typings/main.d.ts" />

import {
  SelectionSet,
} from 'graphql';

import {
  createStore,
} from 'redux';

import {
  assign,
} from 'lodash';

import {
  writeSelectionSetToStore,
} from './writeToStore';

export interface Store {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

// any is here because it's the only way to express null...
export type StoreValue = number | string | string[] | any;

export const QUERY_RESULT_ACTION = 'QUERY_RESULT';

export function createQueryResultAction({
  result,
  selectionSet,
}: {
  result: any,
  selectionSet: SelectionSet,
}): QueryResultAction {
  return {
    type: QUERY_RESULT_ACTION,
    result,
    selectionSet,
  };
}

export interface QueryResultAction {
  type: string;
  result: any;
  selectionSet: SelectionSet;
}

export type ApolloAction = QueryResultAction;

export function createApolloStore() {
  return createStore(resultCacheReducer);
}

export function resultCacheReducer(previousState: Store = {}, action: ApolloAction): Store {
  switch (action.type) {
    case QUERY_RESULT_ACTION:
      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as Store;

      const newState = writeSelectionSetToStore({
        result: action.result,
        selectionSet: action.selectionSet,
        store: clonedState,
      });

      return newState;
    default:
      return previousState;
  }
}
