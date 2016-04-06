import {
  ApolloAction,
  isQueryResultAction,
} from '../actions';

import {
  writeSelectionSetToStore,
} from './writeToStore';

import {
  assign,
} from 'lodash';

import {
  QueryStore,
} from '../queries/store';

export interface NormalizedCache {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

export type StoreValue = number | string | string[];

export function data(
  previousState: NormalizedCache = {},
  action: ApolloAction,
  queries: QueryStore
): NormalizedCache {
  if (isQueryResultAction(action)) {
    // XXX handle partial result due to errors
    if (!action.result.errors) {
      const queryStoreValue = queries[action.queryId];

      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as NormalizedCache;

      const newState = writeSelectionSetToStore({
        result: action.result.data,
        dataId: queryStoreValue.query.id,
        selectionSet: queryStoreValue.query.selectionSet,
        variables: queryStoreValue.variables,
        store: clonedState,
      });

      return newState;
    }

    return previousState;
  } else {
    return previousState;
  }
}
