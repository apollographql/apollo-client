import {
  Request,
  createNetworkInterface,
  NetworkInterface,
  HTTPFetchNetworkInterface,
} from './transport/networkInterface';

import {
  createBatchingNetworkInterface,
  HTTPBatchedNetworkInterface,
} from './transport/batchedNetworkInterface';

import {
  print,
} from 'graphql-tag/bundledPrinter';

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
  SubscriptionOptions,
  FetchPolicy,
} from './core/watchQueryOptions';

import {
  readQueryFromStore,
} from './data/readFromStore';

import {
  writeQueryToStore,
} from './data/writeToStore';

import {
  MutationQueryReducersMap,
} from './data/mutationResults';

import {
  getQueryDefinition,
  getFragmentDefinitions,
  FragmentMap,
  createFragmentMap,
} from './queries/getFromAST';

import {
  NetworkStatus,
} from './queries/networkStatus';

import {
  addTypenameToDocument,
} from './queries/queryTransform';

import {
  ApolloError,
} from './errors/ApolloError';

import ApolloClient from './ApolloClient';

import {
  ApolloQueryResult,
} from './core/types';

import {
  toIdValue,
} from './data/storeUtils';

import {
  IntrospectionFragmentMatcher,
  FragmentMatcherInterface,
} from './data/fragmentMatcher';

export {
  createNetworkInterface,
  createBatchingNetworkInterface,
  createApolloStore,
  createApolloReducer,
  readQueryFromStore,
  writeQueryToStore,
  addTypenameToDocument,
  createFragmentMap,
  NetworkStatus,
  ApolloError,
  getQueryDefinition,
  getFragmentDefinitions,
  FragmentMap,
  Request,
  ApolloQueryResult,
  toIdValue,

  IntrospectionFragmentMatcher,
  FragmentMatcherInterface,

  // Expose the print method from GraphQL so that people that implement
  // custom network interfaces can turn query ASTs into query strings as needed.
  print as printAST,

  // Internal type definitions
  NetworkInterface,
  HTTPFetchNetworkInterface,
  HTTPBatchedNetworkInterface,
  FetchPolicy,
  WatchQueryOptions,
  MutationOptions,
  ObservableQuery,
  MutationQueryReducersMap,
  Subscription,
  SubscriptionOptions,
  ApolloStore,
  ApolloClient
};

export default ApolloClient;
