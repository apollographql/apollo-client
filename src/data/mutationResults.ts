import {
  NormalizedCache,
} from './store';

import {
  GraphQLResult,
  SelectionSet,
} from 'graphql';

import mapValues = require('lodash.mapvalues');
import isArray = require('lodash.isarray');
import cloneDeep = require('lodash.clonedeep');
import assign = require('lodash.assign');

import {
  FragmentMap,
} from '../queries/getFromAST';

import {
  scopeSelectionSetToResultPath,
  scopeJSONToResultPath,
  StorePath,
} from './scopeQuery';

import {
  ApolloReducerConfig,
} from '../store';

import {
  writeSelectionSetToStore,
} from './writeToStore';

// Mutation result action types, these can be used in the `applyResult` argument to client.mutate

export type MutationApplyResultAction =
  MutationArrayInsertAction |
  MutationArrayDeleteAction |
  MutationDeleteAction;

export type MutationArrayInsertAction = {
  type: 'ARRAY_INSERT';
  resultPath: StorePath;
  storePath: StorePath;
  where: ArrayInsertWhere;
}

export type MutationDeleteAction = {
  type: 'DELETE';
  dataId: string;
}

export type MutationArrayDeleteAction = {
  type: 'ARRAY_DELETE';
  storePath: StorePath;
  dataId: string;
}

export type ArrayInsertWhere =
  'PREPEND' |
  'APPEND';

// These are the generic arguments passed into the mutation result reducers
// The `action` field is specific to each reducer
export type MutationResultReducerArgs = {
  state: NormalizedCache;
  action: MutationApplyResultAction;
  result: GraphQLResult;
  variables: any;
  fragmentMap: FragmentMap;
  selectionSet: SelectionSet;
  config: ApolloReducerConfig;
}

export type MutationResultReducerMap = {
  [type: string]: MutationResultReducer;
}

export type MutationResultReducer = (args: MutationResultReducerArgs) => NormalizedCache;

// Reducer for ARRAY_INSERT action
function mutationResultArrayInsertReducer({
  state,
  action,
  result,
  variables,
  fragmentMap,
  selectionSet,
  config,
}: MutationResultReducerArgs): NormalizedCache {
  const {
    resultPath,
    storePath,
    where,
  } = action as MutationArrayInsertAction;

  // Step 1: get selection set and result for resultPath
  const scopedSelectionSet = scopeSelectionSetToResultPath({
    selectionSet,
    fragmentMap,
    path: resultPath,
  });

  const scopedResult = scopeJSONToResultPath({
    json: result.data,
    path: resultPath,
  });

  // OK, now we need to get a dataID to pass to writeSelectionSetToStore
  const dataId = config.dataIdFromObject(scopedResult) || generateMutationResultDataId();

  // Step 2: insert object into store with writeSelectionSet
  state = writeSelectionSetToStore({
    result: scopedResult,
    dataId,
    selectionSet: scopedSelectionSet,
    store: state,
    variables,
    dataIdFromObject: config.dataIdFromObject,
    fragmentMap,
  });

  // Step 3: insert dataId reference into storePath array
  const dataIdOfObj = storePath.shift();
  const clonedObj = cloneDeep(state[dataIdOfObj]);
  const array = scopeJSONToResultPath({
    json: clonedObj,
    path: storePath,
  });

  if (where === 'PREPEND') {
    array.unshift(dataId);
  } else if (where === 'APPEND') {
    array.push(dataId);
  } else {
    throw new Error('Unsupported "where" option to ARRAY_INSERT.');
  }

  return assign(state, {
    [dataIdOfObj]: clonedObj,
  }) as NormalizedCache;
}

// Helper for ARRAY_INSERT.
// When writing query results to the store, we generate IDs based on their path in the query. Here,
// we don't have access to such uniquely identifying information, so the best we can do is a
// sequential ID.
let currId = 0;
function generateMutationResultDataId() {
  currId++;
  return `ARRAY_INSERT-gen-id-${currId}`;
}

// Reducer for 'DELETE' action
function mutationResultDeleteReducer({
  action,
  state,
}: MutationResultReducerArgs): NormalizedCache {
  const {
    dataId,
  } = action as MutationDeleteAction;

  // Delete the object
  delete state[dataId];

  // Now we need to go through the whole store and remove all references
  const newState = mapValues(state, (storeObj) => {
    return removeRefsFromStoreObj(storeObj, dataId);
  });

  return newState;
}

function removeRefsFromStoreObj(storeObj, dataId) {
  let affected = false;

  const cleanedObj = mapValues(storeObj, (value, key) => {
    if (value === dataId) {
      affected = true;
      return null;
    }

    if (isArray(value)) {
      affected = true;
      return cleanArray(value, dataId);
    }
  });

  if (affected) {
    // Maintain === for unchanged objects
    return cleanedObj;
  } else {
    return storeObj;
  }
}

function cleanArray(arr, dataId) {
  if (arr.length && isArray(arr[0])) {
    // Handle arbitrarily nested arrays
    return arr.map((nestedArray) => cleanArray(nestedArray, dataId));
  } else {
    // XXX this will create a new array reference even if no items were removed
    // switch to this: https://twitter.com/leeb/status/747601132080377856
    return arr.filter((item) => item !== dataId);
  }
}

// Reducer for 'ARRAY_DELETE' action
function mutationResultArrayDeleteReducer({
  action,
  state,
}: MutationResultReducerArgs): NormalizedCache {
  const {
    dataId,
    storePath,
  } = action as MutationArrayDeleteAction;

  const dataIdOfObj = storePath.shift();
  const clonedObj = cloneDeep(state[dataIdOfObj]);
  const array = scopeJSONToResultPath({
    json: clonedObj,
    path: storePath,
  });

  array.splice(array.indexOf(dataId), 1);

  return assign(state, {
    [dataIdOfObj]: clonedObj,
  }) as NormalizedCache;
}

// Combines all of the default reducers into a map based on the action type they accept
// The action type is used to pick the right reducer when evaluating the result of the mutation
export const defaultMutationResultReducers: { [type: string]: MutationResultReducer } = {
  'ARRAY_INSERT': mutationResultArrayInsertReducer,
  'DELETE': mutationResultDeleteReducer,
  'ARRAY_DELETE': mutationResultArrayDeleteReducer,
};
