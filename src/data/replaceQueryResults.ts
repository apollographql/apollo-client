import { NormalizedCache } from './storeUtils';

import { writeResultToStore } from './writeToStore';

import { ApolloReducerConfig } from '../store';

import { DocumentNode } from 'graphql';

export function replaceQueryResults(
  state: NormalizedCache,
  {
    variables,
    document,
    newResult,
  }: {
    variables: any;
    document: DocumentNode;
    newResult: Object;
  },
  config: ApolloReducerConfig,
) {
  return writeResultToStore({
    result: newResult,
    dataId: 'ROOT_QUERY',
    variables,
    document,
    store: state,
    dataIdFromObject: config.dataIdFromObject,
    fragmentMatcherFunction: config.fragmentMatcher,
  });
}
