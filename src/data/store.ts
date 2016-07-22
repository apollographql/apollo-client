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

    // XXX handle partial result due to errors
    if (! graphQLResultHasError(action.result)) {

      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as NormalizedCache;

      const newState = writeSelectionSetToStore({
        result: action.result.data,
        dataId: action.minimizedQuery.id,
        selectionSet: action.minimizedQuery.selectionSet,
        variables: action.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMap: action.fragmentMap,
      });

      return newState;
    }
  } else if (isMutationResultAction(action)) {
    // Incorporate the result from this mutation into the store
    if (!action.result.errors) {

      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as NormalizedCache;

      let newState = writeSelectionSetToStore({
        result: action.result.data,
        dataId: action.mutation.id,
        selectionSet: action.mutation.selectionSet,
        variables: action.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMap: action.fragmentMap,
      });

      if (action.resultBehaviors) {
        action.resultBehaviors.forEach((behavior) => {
          const args: MutationBehaviorReducerArgs = {
            behavior,
            result: action.result,
            variables: action.variables,
            fragmentMap: action.fragmentMap,
            selectionSet: action.mutation.selectionSet,
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
