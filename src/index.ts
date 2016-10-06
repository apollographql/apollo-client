import {
  createNetworkInterface,
} from './transport/networkInterface';

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
} from './core/watchQueryOptions';

import {
  readQueryFromStore,
} from './data/readFromStore';

import {
  writeQueryToStore,
  writeFragmentToStore,
} from './data/writeToStore';

import {
  addTypenameToSelectionSet,
} from './queries/queryTransform';

import {
  MutationBehavior,
  MutationQueryReducersMap,
} from './data/mutationResults';

import {
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

// We expose the print method from GraphQL so that people that implement
// custom network interfaces can turn query ASTs into query strings as needed.
export {
  createNetworkInterface,
  createApolloStore,
  createApolloReducer,
  readQueryFromStore,
  addTypenameToSelectionSet as addTypename,
  writeQueryToStore,
  writeFragmentToStore,
  print as printAST,
  createFragmentMap,
  ApolloError,

  // fragment stuff
  createFragment,
  clearFragmentDefinitions,
  disableFragmentWarnings,
  enableFragmentWarnings,

  // internal type definitions for export
  WatchQueryOptions,
  ObservableQuery,
  MutationBehavior,
  MutationQueryReducersMap,
  Subscription,
  ApolloStore,
};

export default ApolloClient;
