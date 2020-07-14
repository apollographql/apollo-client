/* Core */

export {
  ApolloClient,
  ApolloClientOptions,
  DefaultOptions
} from '../ApolloClient';
export {
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
  ApolloCurrentQueryResult,
} from './ObservableQuery';
export {
  QueryBaseOptions,
  QueryOptions,
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
  FetchPolicy,
  WatchQueryFetchPolicy,
  ErrorPolicy,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  MutationUpdaterFn,
} from './watchQueryOptions';
export { NetworkStatus } from './networkStatus';
export * from './types';
export {
  Resolver,
  FragmentMatcher as LocalStateFragmentMatcher,
} from './LocalState';
export { isApolloError, ApolloError } from '../errors/ApolloError';

/* Cache */

export * from '../cache';

/* Link */

export * from '../link/core';
export * from '../link/http';
export * from '../link/utils';
export {
  Observable,
  Observer,
  ObservableSubscription
} from '../utilities/observables/Observable';

/* Supporting */

// Note that importing `gql` by itself, then destructuring
// additional properties separately before exporting, is intentional.
// Due to the way the `graphql-tag` library is setup, certain bundlers
// can't find the properties added to the exported `gql` function without
// additional guidance (e.g. Rollup - see
// https://rollupjs.org/guide/en/#error-name-is-not-exported-by-module).
// Instead of having people that are using bundlers with `@apollo/client` add
// extra bundler config to help `graphql-tag` exports be found (which would be
// awkward since they aren't importing `graphql-tag` themselves), this
// workaround of pulling the extra properties off the `gql` function,
// then re-exporting them separately, helps keeps bundlers happy without any
// additional config changes.
import gql from 'graphql-tag';
export const {
  resetCaches,
  disableFragmentWarnings,
  enableExperimentalFragmentVariables,
  disableExperimentalFragmentVariables
} = gql;
export { gql };
