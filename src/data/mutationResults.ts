import {
  NormalizedCache,
} from './store';

import {
  GraphQLResult,
  SelectionSet,
} from 'graphql';

import mapValues = require('lodash.mapvalues');
import isArray = require('lodash.isarray');

import {
  FragmentMap,
} from '../queries/getFromAST';

import {
  scopeSelectionSetToResultPath,
  scopeJSONToResultPath,
} from './scopeQuery';

import {
  ApolloReducerConfig,
} from '../store';

import {
  writeSelectionSetToStore,
} from './writeToStore';

export type MutationApplyResultAction =
  MutationArrayInsertAction |
  MutationDeleteAction;

export type MutationArrayInsertAction = {
  type: 'ARRAY_INSERT';
  resultPath: string[];
  storePath: string[];
  where: ArrayInsertWhere;
}

export type MutationDeleteAction = {
  type: 'DELETE';
  dataId: string;
}

export type ArrayInsertWhere =
  'PREPEND' |
  'APPEND';


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
  //   This might actually be a relatively complex operation, on the level of
  //   writing a query... perhaps we can factor that out
  //   Note: this is also necessary for incorporating defer results..!
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
  // XXX generate dataID here!
  const dataId = config.dataIdFromObject(scopedResult) || 'xxx';

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
  const array = scopeJSONToResultPath({
    json: state,
    path: storePath,
  });

  if (where === 'PREPEND') {
    array.unshift(dataId);
  } else if (where === 'APPEND') {
    array.push(dataId);
  } else {
    throw new Error('Unsupported "where" option to ARRAY_INSERT.');
  }

  return state;
}

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
    return arr.filter((item) => item !== dataId);
  }
}

export const defaultMutationResultReducers: { [type: string]: MutationResultReducer } = {
  'ARRAY_INSERT': mutationResultArrayInsertReducer,
  'DELETE': mutationResultDeleteReducer,
};

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
