/* Core */

export {
  ApolloClient,
} from '../ApolloClient';
export type {
  ApolloClientOptions,
  DefaultOptions
} from '../ApolloClient';
export {
  ObservableQuery,
} from '../core/ObservableQuery';
export type {
  FetchMoreOptions,
  UpdateQueryOptions,
  ApolloCurrentQueryResult,
} from '../core/ObservableQuery';
export type {
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
} from '../core/watchQueryOptions';
export { NetworkStatus } from '../core/networkStatus';
export * from '../core/types';
export type {
  Resolver,
  FragmentMatcher as LocalStateFragmentMatcher,
} from '../core/LocalState';
export { isApolloError, ApolloError } from '../errors/ApolloError';

/* Cache */

export * from '../cache';

/* Link */

export { empty } from '../link/core/empty';
export { from } from '../link/core/from';
export { split } from '../link/core/split';
export { concat } from '../link/core/concat';
export { execute } from '../link/core/execute';
export { ApolloLink } from '../link/core/ApolloLink';
export * from '../link/core/types';
export { parseAndCheckHttpResponse } from '../link/http/parseAndCheckHttpResponse';
export type { ServerParseError } from '../link/http/parseAndCheckHttpResponse';
export { serializeFetchParameter } from '../link/http/serializeFetchParameter';
export type { ClientParseError } from '../link/http/serializeFetchParameter';
export {
  fallbackHttpConfig,
  selectHttpOptionsAndBody,
} from '../link/http/selectHttpOptionsAndBody';
export type {
  HttpOptions,
  UriFunction
} from '../link/http/selectHttpOptionsAndBody';
export { checkFetcher } from '../link/http/checkFetcher';
export { createSignalIfSupported } from '../link/http/createSignalIfSupported';
export { selectURI } from '../link/http/selectURI';
export { createHttpLink } from '../link/http/createHttpLink';
export { HttpLink } from '../link/http/HttpLink';
export { fromError } from '../link/utils/fromError';
export { toPromise } from '../link/utils/toPromise';
export { fromPromise } from '../link/utils/fromPromise';
export { throwServerError } from '../link/utils/throwServerError';
export type { ServerError } from '../link/utils/throwServerError';
export { Observable } from '../utilities/observables/Observable';
export type {
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
