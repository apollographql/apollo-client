import {
  NormalizedCache,
} from './store';

import {
  SelectionSet,
  FragmentDefinition,
} from 'graphql';

import {
  writeSelectionSetToStore,
} from './writeToStore';

import {
  createFragmentMap,
} from '../queries/getFromAST';

import {
  ApolloReducerConfig,
} from '../store';

import assign = require('lodash.assign');

export function replaceQueryResults(state: NormalizedCache, {
  queryVariables,
  querySelectionSet,
  queryFragments,
  newResult,
}: {
  queryVariables: any;
  querySelectionSet: SelectionSet;
  queryFragments: FragmentDefinition[];
  newResult: Object;
}, config: ApolloReducerConfig) {
  const clonedState = assign({}, state) as NormalizedCache;

  return writeSelectionSetToStore({
    result: newResult,
    dataId: 'ROOT_QUERY',
    selectionSet: querySelectionSet,
    variables: queryVariables,
    store: clonedState,
    dataIdFromObject: config.dataIdFromObject,
    fragmentMap: createFragmentMap(queryFragments),
  });
}
