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
export type {
  ApolloQueryResult,
  DefaultContext,
  ErrorLike,
  InternalRefetchQueriesInclude,
  InternalRefetchQueriesMap,
  InternalRefetchQueriesOptions,
  InternalRefetchQueriesResult,
  InternalRefetchQueryDescriptor,
  MethodKeys,
  MutateResult,
  MutationQueryReducer,
  MutationQueryReducersMap,
  MutationUpdaterFn,
  MutationUpdaterFunction,
  OnQueryUpdated,
  OperationVariables,
  QueryListener,
  QueryResult,
  RefetchQueriesInclude,
  RefetchQueriesOptions,
  RefetchQueriesPromiseResults,
  RefetchQueriesResult,
  RefetchQueryDescriptor,
  Resolvers,
  SubscribeResult,
  TypedDocumentNode,
} from "./types.js";
export type { FragmentMatcher, Resolver } from "./LocalState.js";
export {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
  ServerParseError,
  UnconventionalError,
} from "@apollo/client/errors";
/* Cache */

export type {
  ApolloReducerConfig,
  Cache,
  DataProxy,
  DiffQueryAgainstStoreOptions,
  FieldFunctionOptions,
  FieldMergeFunction,
  FieldPolicy,
  FieldReadFunction,
  IdGetter,
  IdGetterObj,
  InMemoryCacheConfig,
  MergeInfo,
  MergeTree,
  NormalizedCache,
  NormalizedCacheObject,
  OptimisticStoreItem,
  PossibleTypesMap,
  ReactiveVar,
  ReadMergeModifyContext,
  ReadQueryOptions,
  StoreValue,
  // All the exports (types) from ../cache, minus cacheSlot,
  // which we want to keep semi-private.
  Transaction,
  TypePolicies,
  TypePolicy,
  WatchFragmentOptions,
  WatchFragmentResult,
} from "@apollo/client/cache";

export {
  ApolloCache,
  defaultDataIdFromObject,
  InMemoryCache,
  makeVar,
  MissingFieldError,
} from "@apollo/client/cache";

/* Link */

export {
  ApolloLink,
  concat,
  empty,
  execute,
  from,
  split,
} from "@apollo/client/link/core";
export type {
  ApolloPayloadResult,
  DocumentNode,
  ExecutionPatchIncrementalResult,
  ExecutionPatchInitialResult,
  ExecutionPatchResult,
  FetchResult,
  GraphQLRequest,
  IncrementalPayload,
  NextLink,
  Operation,
  Path,
  RequestHandler,
  SingleExecutionResult,
} from "@apollo/client/link/core";

export {
  checkFetcher,
  createHttpLink,
  createSignalIfSupported,
  defaultPrinter,
  fallbackHttpConfig,
  HttpLink,
  parseAndCheckHttpResponse,
  rewriteURIForGET,
  selectHttpOptionsAndBody,
  // TODO remove: needed by @apollo/client/link/batch-http but not public
  selectHttpOptionsAndBodyInternal,
  selectURI,
  serializeFetchParameter,
} from "@apollo/client/link/http";
export type {
  ClientParseError,
  HttpOptions,
  UriFunction,
} from "@apollo/client/link/http";

/* Masking */
export type {
  DataMasking,
  FragmentType,
  Masked,
  MaskedDocumentNode,
  MaybeMasked,
  Unmasked,
} from "@apollo/client/masking";

/* Utilities */

export type {
  DocumentTransformCacheKey,
  Reference,
  StoreObject,
} from "@apollo/client/utilities";
export {
  DocumentTransform,
  isReference,
  makeReference,
  Observable,
} from "@apollo/client/utilities";

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
export { version } from "../version.js";
