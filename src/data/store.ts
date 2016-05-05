import {
  ApolloAction,
  isQueryResultAction,
  isMutationResultAction,
} from '../actions';

import {
  writeSelectionSetToStore,
} from './writeToStore';

import assign = require('lodash.assign');

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
  queries: QueryStore,
  mutations: MutationStore,
  config: ApolloReducerConfig
): NormalizedCache {
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
      });

      return newState;
    }
  } else if (isMutationResultAction(action)) {
    // Incorporate the result from this mutation into the store
    if (!action.result.errors) {
      const queryStoreValue = mutations[action.mutationId];

      // XXX use immutablejs instead of cloning
      const clonedState = assign({}, previousState) as NormalizedCache;

      const newState = writeSelectionSetToStore({
        result: action.result.data,
        dataId: queryStoreValue.mutation.id,
        selectionSet: queryStoreValue.mutation.selectionSet,
        variables: queryStoreValue.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
      });

      return newState;
    }
  }

  return previousState;
}
