import {
  OperationDefinition,
} from 'graphql';

import {
  createStore,
  compose,
  applyMiddleware,
  combineReducers,
} from 'redux';

import {
  data,
  NormalizedCache,
} from './data/store';

import {
  ApolloAction,
} from './actions';

export interface Store {
  data: NormalizedCache;
  queries: QueryStore;
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

export function queries(
  previousState: QueryStore = {},
  action: ApolloAction
): QueryStore {
  return previousState;
}
