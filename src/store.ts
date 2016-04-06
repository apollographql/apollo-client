import {
  createStore,
  compose,
  applyMiddleware,
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

export function apolloReducer(state = {} as Store, action: ApolloAction) {
  return {
    queries: queries(state.queries, action),

    // Note that we are passing the queries into this, because it reads them to associate
    // the query ID in the result with the actual query
    data: data(state.data, action, state.queries),
  };
}

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
