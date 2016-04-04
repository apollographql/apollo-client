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
  queries,
  QueryStore,
} from './queries/store';

import {
  ApolloAction,
} from './actions';

export interface Store {
  data: NormalizedCache;
  queries: QueryStore;
}

// This is our interface on top of Redux to get types in our actions and store
export interface ApolloStore {
  dispatch: (action: ApolloAction) => void;
  getState: () => Store;
  subscribe: (listener: () => void) => void;
}

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

export function createApolloStore(): ApolloStore {
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
