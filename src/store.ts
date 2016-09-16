import {
  createStore,
  compose as reduxCompose,
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
  optimistic,
  OptimisticStore,
} from './optimistic-data/store';

import {
  ApolloAction,
} from './actions';

import {
  IdGetter,
} from './data/extensions';

import {
  MutationBehaviorReducerMap,
} from './data/mutationResults';

import assign = require('lodash.assign');

export interface Store {
  data: NormalizedCache;
  queries: QueryStore;
  mutations: MutationStore;
  optimistic: OptimisticStore;
}

/**
 * This is an interface that describes the behavior of a Apollo store, which is currently
 * implemented through redux.
 */
export interface ApolloStore {
  dispatch: (action: ApolloAction) => void;

  // We don't know what this will return because it could have any number of custom keys when
  // integrating with an existing store
  getState: () => any;
}

const crashReporter = (store: any) => (next: any) => (action: any) => {
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
      optimistic: [] as any,
    };

    // Note, we need to have the results of the
    // APOLLO_MUTATION_INIT action to simulate
    // the APOLLO_MUTATION_RESULT action. That's
    // why we pass in newState
    newState.optimistic = optimistic(
      state.optimistic,
      action,
      newState,
      config
    );

    return newState;
  };
}

export function createApolloStore({
  reduxRootKey = 'apollo',
  initialState,
  config = {},
  reportCrashes,
}: {
  reduxRootKey?: string,
  initialState?: any,
  config?: ApolloReducerConfig,
  reportCrashes?: boolean,
} = {}): ApolloStore {
  const enhancers: any[] = [];

  if (reportCrashes === undefined) {
    reportCrashes = true;
  }

  if (typeof window !== 'undefined') {
    const anyWindow = window as any;
    if (anyWindow.devToolsExtension) {
      enhancers.push(anyWindow.devToolsExtension());
    }
  }

  if (reportCrashes) {
    enhancers.push(applyMiddleware(crashReporter));
  }

  // XXX to avoid type fail
  const compose: (...args: any[]) => () => any = reduxCompose;

  return createStore(
    combineReducers({ [reduxRootKey]: createApolloReducer(config) as any }), // XXX see why this type fails
    initialState,
    compose(...enhancers),
  );
}


export interface ApolloReducerConfig {
  dataIdFromObject?: IdGetter;
  mutationBehaviorReducers?: MutationBehaviorReducerMap;
}

export function getDataWithOptimisticResults(store: Store): NormalizedCache {
  if (store.optimistic.length === 0) {
    return store.data;
  }
  const patches = store.optimistic.map(opt => opt.data);
  return assign({}, store.data, ...patches) as NormalizedCache;
}
