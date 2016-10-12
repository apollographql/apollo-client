import {
  NormalizedCache,
} from './store';

import {
  writeResultToStore,
} from './writeToStore';

import {
  ApolloReducerConfig,
} from '../store';

import {
  Document,
} from 'graphql';

import assign = require('lodash.assign');

export function replaceQueryResults(state: NormalizedCache, {
  variables,
  document,
  newResult,
}: {
  variables: any;
  document: Document;
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
