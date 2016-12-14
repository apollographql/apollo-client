import {
  NormalizedCache,
} from './storeUtils';

import {
  writeResultToStore,
} from './writeToStore';

import {
  ApolloReducerConfig,
} from '../store';

import {
  DocumentNode,
} from 'graphql';

import assign = require('lodash/assign');

export function replaceQueryResults(state: NormalizedCache, {
  variables,
  document,
  newResult,
}: {
  variables: any;
  document: DocumentNode;
  newResult: Object;
}, config: ApolloReducerConfig) {
  const clonedState = assign({}, state) as NormalizedCache;

  return writeResultToStore({
    result: newResult,
    dataId: 'ROOT_QUERY',
    variables,
    document,
    store: clonedState,
    dataIdFromObject: config.dataIdFromObject,
  });
}
