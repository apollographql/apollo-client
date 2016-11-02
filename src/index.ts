import {
  Request,
  createNetworkInterface,
} from './transport/networkInterface';

import {
  createBatchingNetworkInterface,
} from './transport/batchedNetworkInterface';

import {
  print,
} from 'graphql-tag/printer';

import {
  createApolloStore,
  ApolloStore,
  createApolloReducer,
} from './store';

import {
  ObservableQuery,
} from './core/ObservableQuery';

import {
  Subscription,
} from './util/Observable';

import {
  WatchQueryOptions,
  MutationOptions,
  DeprecatedSubscriptionOptions,
} from './core/watchQueryOptions';

import {
  readQueryFromStore,
} from './data/readFromStore';

import {
  writeQueryToStore,
} from './data/writeToStore';

import {
  MutationBehavior,
  MutationQueryReducersMap,
} from './data/mutationResults';

import {
  getQueryDefinition,
  getFragmentDefinitions,
  FragmentMap,
  createFragmentMap,
} from './queries/getFromAST';

import {
  ApolloError,
} from './errors/ApolloError';

import ApolloClient from './ApolloClient';
import {
  createFragment,
  clearFragmentDefinitions,
  disableFragmentWarnings,
  enableFragmentWarnings,
} from './fragments';

import {
  ApolloQueryResult,
} from './core/QueryManager';

// We expose the print method from GraphQL so that people that implement
// custom network interfaces can turn query ASTs into query strings as needed.
export {
  createNetworkInterface,
  createBatchingNetworkInterface,
  createApolloStore,
  createApolloReducer,
  readQueryFromStore,
  writeQueryToStore,
  print as printAST,
  createFragmentMap,
  ApolloError,

  // fragment stuff
  createFragment,
  clearFragmentDefinitions,
  disableFragmentWarnings,
  enableFragmentWarnings,

  getQueryDefinition,
  getFragmentDefinitions,
  FragmentMap,

  Request,

  ApolloQueryResult,

  // internal type definitions for export
  WatchQueryOptions,
  MutationOptions,
  ObservableQuery,
  MutationBehavior,
  MutationQueryReducersMap,
  Subscription,
  DeprecatedSubscriptionOptions as SubscriptionOptions,
  ApolloStore,
  ApolloClient
};

export default ApolloClient;
