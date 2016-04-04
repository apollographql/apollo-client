import {
  ApolloAction,
  QUERY_RESULT_ACTION,
} from '../actions';

import {
  writeSelectionSetToStore,
} from './writeToStore';

import {
  assign,
} from 'lodash';

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
  action: ApolloAction
): NormalizedCache {
  switch (action.type) {
    case QUERY_RESULT_ACTION:
      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as NormalizedCache;

      const newState = writeSelectionSetToStore({
        result: action.result,
        selectionSet: action.selectionSet,
        variables: action.variables,
        store: clonedState,
      });

      return newState;
    default:
      return previousState;
  }
}
