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

import {
  IdGetter,
} from './data/extensions';

export interface Store {
  data: NormalizedCache;
  queries: QueryStore;
  mutations: MutationStore;
}

// This is our interface on top of Redux to get types in our actions
export interface ApolloStore {
  dispatch: (action: ApolloAction) => void;

  // We don't know what this will return because it could have any number of custom keys when
  // integrating with an existing store
  getState: () => any;
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

export function createApolloReducer(config: ApolloReducerConfig): Function {
  return function apolloReducer(state = {} as Store, action: ApolloAction) {
    const newState = {
      queries: queries(state.queries, action),
      mutations: mutations(state.mutations, action),

      // Note that we are passing the queries into this, because it reads them to associate
      // the query ID in the result with the actual query
      data: data(state.data, action, state.queries, state.mutations, config),
    };

    return newState;
  };
}

export function createApolloStore({
  reduxRootKey = 'apollo',
  initialState,
  config = {},
}: {
  reduxRootKey?: string,
  initialState?: any,
  config?: ApolloReducerConfig,
} = {}): ApolloStore {
  const enhancers = [];

  if (typeof window !== 'undefined') {
    const anyWindow = window as any;
    if (anyWindow.devToolsExtension) {
      enhancers.push(anyWindow.devToolsExtension());
    }
  }

  enhancers.push(applyMiddleware(crashReporter));

  return createStore(
    combineReducers({ [reduxRootKey]: createApolloReducer(config) }),
    initialState,
    compose(...enhancers) as () => any // XXX see why this type fails
  );
}

export interface ApolloReducerConfig {
  dataIdFromObject?: IdGetter;
}
