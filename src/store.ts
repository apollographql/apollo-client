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
  mutations,
  MutationStore,
} from './mutations/store';

import {
  ApolloAction,
} from './actions';

export interface Store {
  data: NormalizedCache;
  queries: QueryStore;
  mutations: MutationStore;
}

// This is our interface on top of Redux to get types in our actions
export interface ApolloStore {
  dispatch: ApolloDispatch;

  // We don't know what this will return because it could have any number of custom keys when
  // integrating with an existing store
  getState: () => any;
}

export type ApolloDispatch = (action: ApolloAction) => void;

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
  const newState = {
    queries: queries(state.queries, action),
    mutations: mutations(state.mutations, action),

    // Note that we are passing the queries into this, because it reads them to associate
    // the query ID in the result with the actual query
    data: data(state.data, action, state.queries, state.mutations),
  };

  return newState;
}

export function createApolloStore(reduxRootKey: string = 'apollo'): ApolloStore {
  const enhancers = [];

  if (typeof window !== 'undefined') {
    const anyWindow = window as any;
    if (anyWindow.devToolsExtension) {
      enhancers.push(anyWindow.devToolsExtension());
    }
  }

  enhancers.push(applyMiddleware(crashReporter));

  return createStore(
    combineReducers({ [reduxRootKey]: apolloReducer }),
    compose(...enhancers)
  );
}
