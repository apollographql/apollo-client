import {
  MutationArrayInsertAction,
} from './mutationResultActions';

import {
  NormalizedCache,
} from './store';

import {
  GraphQLResult,
  SelectionSet,
} from 'graphql';

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
  } = action;

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

export const defaultMutationResultReducers: { [type: string]: MutationResultReducer } = {
  'ARRAY_INSERT': mutationResultArrayInsertReducer,
};

export type MutationResultReducerArgs = {
  state: NormalizedCache;
  action: MutationArrayInsertAction;
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
