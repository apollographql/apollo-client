import { FragmentMatcher } from 'graphql-anywhere';

import { IdGetter } from './core/types';

import { CustomResolverMap } from './data/readFromStore';

export type ApolloReducerConfig = {
  dataIdFromObject?: IdGetter;
  customResolvers?: CustomResolverMap;
  fragmentMatcher?: FragmentMatcher;
  addTypename?: boolean;
};
