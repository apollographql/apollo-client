import {
  MutationArrayInsertAction,
} from './mutationResultActions';

import {
  NormalizedCache,
} from './store';

import {
  GraphQLResult,
  Document,
} from 'graphql';

function mutationResultArrayInsertReducer(
  state: NormalizedCache,
  action: MutationArrayInsertAction,
  result: GraphQLResult
) {
  const {
    resultPath,
    storePath,
    where,
  } = action;

  // Step 1: get selection set and result for resultPath
  //   This might actually be a relatively complex operation, on the level of
  //   writing a query... perhaps we can factor that out
  //   Note: this is also necessary for incorporating defer results..!
  // Step 2: insert object into store with writeSelectionSet
  // Step 3: insert dataId reference into storePath array
}

export const defaultMutationResultReducers = {
  'ARRAY_INSERT': mutationResultArrayInsertReducer,
};
