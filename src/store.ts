import {
  SelectionSet,
} from 'graphql';

import {
  createStore,
  compose,
  applyMiddleware,
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

export type StoreValue = number | string | string[];

export const QUERY_RESULT_ACTION = 'QUERY_RESULT';

export function createQueryResultAction({
  result,
  selectionSet,
  variables,
}: {
  result: any,
  selectionSet: SelectionSet,
  variables: Object
}): QueryResultAction {
  return {
    type: QUERY_RESULT_ACTION,
    result,
    selectionSet,
    variables,
  };
}

export interface QueryResultAction {
  type: string;
  result: any;
  selectionSet: SelectionSet;
  variables: Object;
}

export type ApolloAction = QueryResultAction;

const crashReporter = store => next => action => {
  try {
    return next(action);
  } catch (err) {
    console.error('Caught an exception!', err);
    console.error(err.stack);
    throw err;
  }
};

export function createApolloStore() {
  const enhancers = [];

  if (typeof window !== 'undefined') {
    const anyWindow = window as any;
    if (anyWindow.devToolsExtension) {
      enhancers.push(anyWindow.devToolsExtension());
    }
  }

  enhancers.push(applyMiddleware(crashReporter));

  return createStore(resultCacheReducer, compose(...enhancers));
}

export function resultCacheReducer(previousState: Store = {}, action: ApolloAction): Store {
  switch (action.type) {
    case QUERY_RESULT_ACTION:
      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as Store;

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
