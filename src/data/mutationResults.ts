import {
  NormalizedCache,
  StoreObject,
} from './store';

import {
  GraphQLResult,
  SelectionSet,
  FragmentDefinition,
} from 'graphql';

import mapValues = require('lodash.mapvalues');
import isArray = require('lodash.isarray');
import cloneDeep = require('lodash.clonedeep');
import assign = require('lodash.assign');

import { replaceQueryResults } from './replaceQueryResults';

import {
  writeSelectionSetToStore,
} from './writeToStore';

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

// Mutation behavior types, these can be used in the `resultBehaviors` argument to client.mutate

export type MutationBehavior =
  MutationArrayInsertBehavior |
  MutationArrayDeleteBehavior |
  MutationDeleteBehavior |
  MutationQueryResultBehavior;

export type MutationArrayInsertBehavior = {
  type: 'ARRAY_INSERT';
  resultPath: StorePath;
  storePath: StorePath;
  where: ArrayInsertWhere;
}

export type MutationDeleteBehavior = {
  type: 'DELETE';
  dataId: string;
}

export type MutationArrayDeleteBehavior = {
  type: 'ARRAY_DELETE';
  storePath: StorePath;
  dataId: string;
}

export type MutationQueryResultBehavior = {
  type: 'QUERY_RESULT';
  queryVariables: any;
  querySelectionSet: SelectionSet;
  queryFragments: FragmentDefinition[];
  newResult: Object;
};

export type ArrayInsertWhere =
  'PREPEND' |
  'APPEND';

// These are the generic arguments passed into the mutation result reducers
// The `behavior` field is specific to each reducer
export type MutationBehaviorReducerArgs = {
  behavior: MutationBehavior;
  result: GraphQLResult;
  variables: any;
  fragmentMap: FragmentMap;
  selectionSet: SelectionSet;
  config: ApolloReducerConfig;
}

export type MutationBehaviorReducerMap = {
  [type: string]: MutationBehaviorReducer;
}

export type MutationBehaviorReducer = (state: NormalizedCache, args: MutationBehaviorReducerArgs) => NormalizedCache;

// Reducer for ARRAY_INSERT behavior
function mutationResultArrayInsertReducer(state: NormalizedCache, {
  behavior,
  result,
  variables,
  fragmentMap,
  selectionSet,
  config,
}: MutationBehaviorReducerArgs): NormalizedCache {
  const {
    resultPath,
    storePath,
    where,
  } = behavior as MutationArrayInsertBehavior;

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
  const [dataIdOfObj, ...restStorePath] = storePath;
  const clonedObj = cloneDeep(state[dataIdOfObj]);
  const array = scopeJSONToResultPath({
    json: clonedObj,
    path: restStorePath,
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

// Reducer for 'DELETE' behavior
function mutationResultDeleteReducer(state: NormalizedCache, {
  behavior,
}: MutationBehaviorReducerArgs): NormalizedCache {
  const {
    dataId,
  } = behavior as MutationDeleteBehavior;

  // Delete the object
  delete state[dataId];

  // Now we need to go through the whole store and remove all references
  const newState = mapValues(state, (storeObj: StoreObject) => {
    return removeRefsFromStoreObj(storeObj, dataId);
  });

  return newState;
}

function removeRefsFromStoreObj(storeObj: any, dataId: any) {
  let affected = false;

  const cleanedObj = mapValues(storeObj, (value: any) => {
    if (value === dataId) {
      affected = true;
      return null;
    }

    if (isArray(value)) {
      const filteredArray = cleanArray(value, dataId);

      if (filteredArray !== value) {
        affected = true;
        return filteredArray;
      }
    }

    // If not modified, return the original value
    return value;
  });

  if (affected) {
    // Maintain === for unchanged objects
    return cleanedObj;
  } else {
    return storeObj;
  }
}

// Remove any occurrences of dataId in an arbitrarily nested array, and make sure that the old array
// === the new array if nothing was changed
export function cleanArray(originalArray: any[], dataId: any): any[] {
  if (originalArray.length && isArray(originalArray[0])) {
    // Handle arbitrarily nested arrays
    let modified = false;
    const filteredArray = originalArray.map((nestedArray) => {
      const nestedFilteredArray = cleanArray(nestedArray, dataId);

      if (nestedFilteredArray !== nestedArray) {
        modified = true;
        return nestedFilteredArray;
      }

      return nestedArray;
    });

    if (! modified) {
      return originalArray;
    }

    return filteredArray;
  } else {
    const filteredArray = originalArray.filter((item) => item !== dataId);

    if (filteredArray.length === originalArray.length) {
      // No items were removed, return original array
      return originalArray;
    }

    return filteredArray;
  }
}

// Reducer for 'ARRAY_DELETE' behavior
function mutationResultArrayDeleteReducer(state: NormalizedCache, {
  behavior,
}: MutationBehaviorReducerArgs): NormalizedCache {
  const {
    dataId,
    storePath,
  } = behavior as MutationArrayDeleteBehavior;

  const [dataIdOfObj, ...restStorePath] = storePath;
  const clonedObj = cloneDeep(state[dataIdOfObj]);
  const array = scopeJSONToResultPath({
    json: clonedObj,
    path: restStorePath,
  });

  array.splice(array.indexOf(dataId), 1);

  return assign(state, {
    [dataIdOfObj]: clonedObj,
  }) as NormalizedCache;
}

export function mutationResultQueryResultReducer(state: NormalizedCache, {
  behavior,
  config,
}: MutationBehaviorReducerArgs) {
  return replaceQueryResults(state, behavior as MutationQueryResultBehavior, config);
}

export type MutationQueryReducer = (previousResult: Object, options: {
  mutationResult: Object,
  queryName: Object,
  queryVariables: Object,
}) => Object;

export type MutationQueryReducersMap = {
  [queryName: string]: MutationQueryReducer;
};

// Combines all of the default reducers into a map based on the behavior type they accept
// The behavior type is used to pick the right reducer when evaluating the result of the mutation
export const defaultMutationBehaviorReducers: { [type: string]: MutationBehaviorReducer } = {
  'ARRAY_INSERT': mutationResultArrayInsertReducer,
  'DELETE': mutationResultDeleteReducer,
  'ARRAY_DELETE': mutationResultArrayDeleteReducer,
  'QUERY_RESULT': mutationResultQueryResultReducer,
};
