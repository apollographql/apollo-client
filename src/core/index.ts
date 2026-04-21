/* Core */

export type {
  ApolloClientOptions,
  ApolloQueryResult,
  DefaultOptions,
  DevtoolsOptions,
  MutateResult,
  MutationOptions,
  QueryOptions,
  RefetchQueriesOptions,
  RefetchQueriesResult,
  SubscribeToMoreOptions,
  SubscriptionOptions,
  WatchQueryOptions,
} from "./deprecated.js";
export { ApolloClient } from "./ApolloClient.js";
export { ObservableQuery } from "./ObservableQuery.js";
export type {
  ErrorPolicy,
  FetchPolicy,
  MutationFetchPolicy,
  RefetchWritePolicy,
  SubscribeToMoreFunction,
  SubscribeToMoreUpdateQueryFn,
  UpdateQueryMapFn,
  UpdateQueryOptions,
  WatchQueryFetchPolicy,
} from "./watchQueryOptions.js";
export { NetworkStatus } from "./networkStatus.js";
export type {
  DataState,
  DataValue,
  DefaultContext,
  ErrorLike,
  GetDataState,
  InternalRefetchQueriesInclude,
  InternalRefetchQueriesMap,
  InternalRefetchQueriesOptions,
  InternalRefetchQueriesResult,
  InternalRefetchQueryDescriptor,
  MutationQueryReducer,
  MutationQueryReducersMap,
  MutationUpdaterFunction,
  NormalizedExecutionResult,
  OnQueryUpdated,
  OperationVariables,
  RefetchQueriesInclude,
  RefetchQueriesPromiseResults,
  RefetchQueryDescriptor,
  SubscriptionObservable,
  TypedDocumentNode,
  TypeOverrides,
} from "./types.js";
export {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  LinkError,
  LocalStateError,
  ServerError,
  ServerParseError,
  UnconventionalError,
} from "@apollo/client/errors";
/* Cache */

export type {
  ApolloReducerConfig,
  Cache,
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
} from "@apollo/client/link";
export type {
  ApolloPayloadResult,
  DocumentNode,
  FetchResult,
  GraphQLRequest,
  Operation,
  RequestHandler,
} from "@apollo/client/link";

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
} from "@apollo/client/link/http";

/* Masking */
export type {
  FragmentType,
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
  /** @deprecated Please import `isNetworkRequestSettled` from `@apollo/client/utilities`. */
  isNetworkRequestSettled,
  isReference,
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
export { build, version } from "../version.js";

// internal types
import type { QueryManager } from "./QueryManager.js";
import type { NextFetchPolicyContext } from "./watchQueryOptions.js";
/** @internal */
export declare namespace InternalTypes {
  export type { NextFetchPolicyContext, QueryManager };
}
