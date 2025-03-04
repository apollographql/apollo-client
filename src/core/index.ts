/* Core */

export type { ApolloClientOptions, DefaultOptions } from "./ApolloClient.js";
export { ApolloClient, mergeOptions } from "./ApolloClient.js";
export type { FetchMoreOptions } from "./ObservableQuery.js";
export { ObservableQuery } from "./ObservableQuery.js";
export type {
  ErrorPolicy,
  FetchMoreQueryOptions,
  FetchPolicy,
  MutationFetchPolicy,
  MutationOptions,
  QueryOptions,
  RefetchWritePolicy,
  SubscribeToMoreFunction,
  SubscribeToMoreOptions,
  SubscribeToMoreUpdateQueryFn,
  SubscriptionOptions,
  UpdateQueryMapFn,
  UpdateQueryOptions,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "./watchQueryOptions.js";
export { isNetworkRequestSettled, NetworkStatus } from "./networkStatus.js";
export type * from "./types.js";
export type { FragmentMatcher, Resolver } from "./LocalState.js";
export {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from "../errors/index.js";
/* Cache */

export type {
  DataProxy,
  FieldFunctionOptions,
  FieldMergeFunction,
  FieldPolicy,
  FieldReadFunction,
  InMemoryCacheConfig,
  PossibleTypesMap,
  ReactiveVar,
  // All the exports (types) from ../cache, minus cacheSlot,
  // which we want to keep semi-private.
  Transaction,
  TypePolicies,
  TypePolicy,
  WatchFragmentOptions,
  WatchFragmentResult,
} from "../cache/index.js";
export type { Cache } from "../cache/index.js";
export {
  ApolloCache,
  defaultDataIdFromObject,
  InMemoryCache,
  makeVar,
  MissingFieldError,
} from "../cache/index.js";

export type * from "../cache/inmemory/types.js";

/* Link */

export * from "../link/core/index.js";
export * from "../link/http/index.js";
export type { ServerError } from "../link/utils/index.js";
export { throwServerError } from "../link/utils/index.js";

/* Masking */
export type {
  DataMasking,
  FragmentType,
  Masked,
  MaskedDocumentNode,
  MaybeMasked,
  Unmasked,
} from "../masking/index.js";

/* Utilities */

export type {
  DocumentTransformCacheKey,
  Reference,
  StoreObject,
} from "../utilities/index.js";
export {
  DocumentTransform,
  isReference,
  makeReference,
  Observable,
} from "../utilities/index.js";

/* Supporting */

// The verbosity of invariant.{log,warn,error} can be controlled globally
// by passing "log", "warn", "error", or "silent" to setVerbosity ("log" is the default).
// Note that all invariant.* logging is hidden in production.
export { setVerbosity as setLogVerbosity } from "@apollo/client/utilities/invariant";

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
  disableExperimentalFragmentVariables,
  disableFragmentWarnings,
  enableExperimentalFragmentVariables,
  gql,
  resetCaches,
} from "graphql-tag";
