import {
  ApolloAction,
  isQueryResultAction,
  isMutationResultAction,
  isUpdateQueryResultAction,
  isStoreResetAction,
} from '../actions';

import {
  writeSelectionSetToStore,
} from './writeToStore';

import assign = require('lodash.assign');
import isObject = require('lodash.isobject');

import {
  QueryStore,
} from '../queries/store';

import {
  MutationStore,
} from '../mutations/store';

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

import {
  replaceQueryResults,
} from './replaceQueryResults';

export interface NormalizedCache {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

export interface IdValue {
  type: "id";
  id: string;
  generated: boolean;
}

export interface JsonValue {
  type: "json";
  json: any;
}

export type StoreValue = number | string | string[] | IdValue | JsonValue ;

export function isIdValue(idObject: StoreValue): idObject is IdValue {
  return (isObject(idObject) && (idObject as (IdValue | JsonValue)).type === 'id');
}

export function isJsonValue(jsonObject: StoreValue): jsonObject is JsonValue {
  return (isObject(jsonObject) && (jsonObject as (IdValue | JsonValue)).type === 'json');
}

export function data(
  previousState: NormalizedCache = {},
  action: ApolloAction,
  queries: QueryStore,
  mutations: MutationStore,
  config: ApolloReducerConfig
): NormalizedCache {
  // XXX This is hopefully a temporary binding to get around
  // https://github.com/Microsoft/TypeScript/issues/7719
  const constAction = action;

  if (isQueryResultAction(action)) {
    if (!queries[action.queryId]) {
      return previousState;
    }

    // Ignore results from old requests
    // XXX this means that if you have a refetch interval which is shorter than your roundtrip time,
    // your query will be in the loading state forever!
    if (action.requestId < queries[action.queryId].lastRequestId) {
      return previousState;
    }

    // XXX handle partial result due to errors
    if (! graphQLResultHasError(action.result)) {
      const queryStoreValue = queries[action.queryId];

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
  } else if (isMutationResultAction(constAction)) {
    // Incorporate the result from this mutation into the store
    if (!constAction.result.errors) {
      const queryStoreValue = mutations[constAction.mutationId];

      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as NormalizedCache;

      let newState = writeSelectionSetToStore({
        result: constAction.result.data,
        dataId: queryStoreValue.mutation.id,
        selectionSet: queryStoreValue.mutation.selectionSet,
        variables: queryStoreValue.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMap: queryStoreValue.fragmentMap,
      });

      if (constAction.resultBehaviors) {
        constAction.resultBehaviors.forEach((behavior) => {
          const args: MutationBehaviorReducerArgs = {
            behavior,
            result: constAction.result,
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
  } else if (isUpdateQueryResultAction(constAction)) {
    return replaceQueryResults(previousState, constAction, config) as NormalizedCache;
  } else if (isStoreResetAction(action)) {
    // If we are resetting the store, we no longer need any of the data that is currently in
    // the store so we can just throw it all away.
    return {};
  }

  return previousState;
}
