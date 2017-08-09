export { print as printAST } from 'graphql/language/printer';
export { Operation } from 'apollo-link-core';

export {
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
} from './core/ObservableQuery';
export {
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
  FetchPolicy,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
} from './core/watchQueryOptions';
export * from './core/types';

export {
  HeuristicFragmentMatcher,
  IntrospectionFragmentMatcher,
} from './fragments/fragmentMatcher';

export {
  getQueryDefinition,
  getMutationDefinition,
  getOperationDefinition,
  getFragmentDefinitions,
  getDefaultValues,
  FragmentMap,
  createFragmentMap,
} from './queries/getFromAST';
export { NetworkStatus } from './queries/networkStatus';
export { addTypenameToDocument } from './queries/queryTransform';
export { shouldInclude } from './queries/directives';

export * from './data/types';
export * from './data/storeUtils';

export { Subscription } from './util/Observable';
export { assign } from './util/assign';
export { isEqual } from './util/isEqual';
export { isProduction } from './util/environment';

export { ApolloError } from './errors/ApolloError';

export { defaultDataIdFromObject } from './ApolloClient';
import ApolloClient from './ApolloClient';

export default ApolloClient;
