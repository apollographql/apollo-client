import {
  ApolloAction,
  isQueryResultAction,
  isMutationResultAction,
  isStoreResetAction,
} from '../actions';

import {
  writeSelectionSetToStore,
} from './writeToStore';

import assign = require('lodash.assign');

import {
  ApolloReducerConfig,
} from '../store';

import {
  graphQLResultHasError,
} from './storeUtils';

import {
  defaultMutationBehaviorReducers,
  MutationBehaviorReducerArgs,
} from './mutationResults';

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
  config: ApolloReducerConfig
): NormalizedCache {
  if (isQueryResultAction(action)) {
    if (!action.queryStoreValue) {
      return previousState;
    }

    // Ignore results from old requests
    // XXX this means that if you have a refetch interval which is shorter than your roundtrip time,
    // your query will be in the loading state forever!
    if (action.requestId < action.queryStoreValue.lastRequestId) {
      return previousState;
    }

    // XXX handle partial result due to errors
    if (! graphQLResultHasError(action.result)) {
      const queryStoreValue = action.queryStoreValue;

      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as NormalizedCache;

      const newState = writeSelectionSetToStore({
        result: action.result.data,
        dataId: queryStoreValue.minimizedQuery.id,
        selectionSet: queryStoreValue.minimizedQuery.selectionSet,
        variables: queryStoreValue.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMap: queryStoreValue.fragmentMap,
      });

      return newState;
    }
  } else if (isMutationResultAction(action)) {
    // Incorporate the result from this mutation into the store
    if (!action.result.errors) {
      const queryStoreValue = action.mutationStoreValue;

      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as NormalizedCache;

      let newState = writeSelectionSetToStore({
        result: action.result.data,
        dataId: queryStoreValue.mutation.id,
        selectionSet: queryStoreValue.mutation.selectionSet,
        variables: queryStoreValue.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMap: queryStoreValue.fragmentMap,
      });

      if (action.resultBehaviors) {
        action.resultBehaviors.forEach((behavior) => {
          const args: MutationBehaviorReducerArgs = {
            behavior,
            result: action.result,
            variables: queryStoreValue.variables,
            fragmentMap: queryStoreValue.fragmentMap,
            selectionSet: queryStoreValue.mutation.selectionSet,
            config,
          };

          if (defaultMutationBehaviorReducers[behavior.type]) {
            newState = defaultMutationBehaviorReducers[behavior.type](newState, args);
          } else if (config.mutationBehaviorReducers[behavior.type]) {
            newState = config.mutationBehaviorReducers[behavior.type](newState, args);
          } else {
            throw new Error(`No mutation result reducer defined for type ${behavior.type}`);
          }
        });
      }

      return newState;
    }
  } else if (isStoreResetAction(action)) {
    // If we are resetting the store, we no longer need any of the data that is currently in
    // the store so we can just throw it all away.
    return {};
  }

  return previousState;
}
