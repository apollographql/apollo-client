import { print } from 'graphql/language/printer';

import {
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
} from './core/ObservableQuery';

import { Subscription } from './util/Observable';

import {
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
  FetchPolicy,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
} from './core/watchQueryOptions';

import { readQueryFromStore } from './data/readFromStore';

import { writeQueryToStore } from './data/writeToStore';

import { MutationQueryReducersMap } from './data/mutationResults';

import {
  getQueryDefinition,
  getMutationDefinition,
  getFragmentDefinitions,
  FragmentMap,
  createFragmentMap,
} from './queries/getFromAST';

import { NetworkStatus } from './queries/networkStatus';

import { addTypenameToDocument } from './queries/queryTransform';

import { ApolloError } from './errors/ApolloError';

import ApolloClient from './ApolloClient';

import { ApolloQueryResult } from './core/types';

import { toIdValue } from './data/storeUtils';

import {
  IntrospectionFragmentMatcher,
  FragmentMatcherInterface,
} from './data/fragmentMatcher';

export { Operation as Request } from 'apollo-link-core';

export {
  readQueryFromStore,
  writeQueryToStore,
  addTypenameToDocument,
  createFragmentMap,
  NetworkStatus,
  ApolloError,
  getQueryDefinition,
  getMutationDefinition,
  getFragmentDefinitions,
  FragmentMap,
  ApolloQueryResult,
  toIdValue,
  IntrospectionFragmentMatcher,
  FragmentMatcherInterface,
  // Expose the print method from GraphQL so that people that implement
  // custom network interfaces can turn query ASTs into query strings as needed.
  print as printAST,
  // Internal type definitions
  FetchPolicy,
  WatchQueryOptions,
  MutationOptions,
  ObservableQuery,
  MutationQueryReducersMap,
  Subscription,
  SubscriptionOptions,
  ApolloClient,
  FetchMoreOptions,
  UpdateQueryOptions,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
};

export default ApolloClient;
