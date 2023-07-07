/* Core */

export {
  ApolloClient,
  ApolloClientOptions,
  DefaultOptions,
  mergeOptions,
} from './ApolloClient.js';
export {
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
} from './ObservableQuery.js';
export {
  QueryOptions,
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
  FetchPolicy,
  WatchQueryFetchPolicy,
  ErrorPolicy,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
} from './watchQueryOptions.js';
export { NetworkStatus, isNetworkRequestSettled } from './networkStatus.js';
export * from './types.js';
export {
  Resolver,
  FragmentMatcher,
} from './LocalState.js';
export { isApolloError, ApolloError } from '../errors/index.js';
/* Cache */

export {
  // All the exports (types and values) from ../cache, minus cacheSlot,
  // which we want to keep semi-private.
  Cache,
  ApolloCache,
  Transaction,
  DataProxy,
  InMemoryCache,
  InMemoryCacheConfig,
  MissingFieldError,
  defaultDataIdFromObject,
  ReactiveVar,
  makeVar,
  TypePolicies,
  TypePolicy,
  FieldPolicy,
  FieldReadFunction,
  FieldMergeFunction,
  FieldFunctionOptions,
  PossibleTypesMap,
} from '../cache/index.js';

export * from '../cache/inmemory/types.js';

/* Link */

export * from '../link/core/index.js';
export * from '../link/http/index.js';
export {
  fromError,
  toPromise,
  fromPromise,
  ServerError,
  throwServerError,
} from '../link/utils/index.js';

/* Utilities */

export {
  DocumentTransform,
  DocumentTransformCacheKey,
  Observable,
  Observer,
  ObservableSubscription,
  Reference,
  isReference,
  makeReference,
  StoreObject,
} from '../utilities/index.js';

/* Supporting */

// The verbosity of invariant.{log,warn,error} can be controlled globally
// (for anyone using the same ts-invariant package) by passing "log",
// "warn", "error", or "silent" to setVerbosity ("log" is the default).
// Note that all invariant.* logging is hidden in production.
import { setVerbosity } from "ts-invariant";
export { setVerbosity as setLogVerbosity }
setVerbosity(__DEV__ ? "log" : "silent");

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
export {
  gql,
  resetCaches,
  disableFragmentWarnings,
  enableExperimentalFragmentVariables,
  disableExperimentalFragmentVariables,
} from 'graphql-tag';
