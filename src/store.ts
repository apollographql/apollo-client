import {
  SelectionSet,
  OperationDefinition,
} from 'graphql';

import {
  createStore,
  compose,
  applyMiddleware,
  combineReducers,
} from 'redux';

import {
  assign,
} from 'lodash';

import {
  writeSelectionSetToStore,
} from './writeToStore';

export interface Store {
  data: NormalizedCache;
  queries: QueryStore;
}

export interface NormalizedCache {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

export interface QueryStore {
  [queryId: string]: QueryStoreValue;
}

export interface QueryStoreValue {
  queryString: string;
  queryAst: OperationDefinition;
  minimizedQueryString: string;
  minimizedQueryAST: OperationDefinition;
  variables: Object;
  status: QueryStatus;
  error: Error;
}

export type QueryStatus =
  // Query has been sent to server, waiting for response
  "LOADING" |

  // Network error occurred, we didn't get any result
  "ERROR" |

  // We got a GraphQL result from the server, and it's in the store
  "DONE";

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

export const apolloReducer = combineReducers({
  data,
  queries,
});

export function createApolloStore() {
  const enhancers = [];

  if (typeof window !== 'undefined') {
    const anyWindow = window as any;
    if (anyWindow.devToolsExtension) {
      enhancers.push(anyWindow.devToolsExtension());
    }
  }

  enhancers.push(applyMiddleware(crashReporter));

  return createStore(apolloReducer, compose(...enhancers));
}

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

export function queries(
  previousState: QueryStore = {},
  action: ApolloAction
): QueryStore {
  return previousState;
}
