export type { ApolloContextValue } from "./context/index.js";
export {
  ApolloConsumer,
  ApolloProvider,
  getApolloContext,
} from "./context/index.js";

export type { SkipToken } from "./hooks/index.js";
export {
  skipToken,
  useApolloClient,
  useBackgroundQuery,
  useFragment,
  useLazyQuery,
  useLoadableQuery,
  useMutation,
  useQuery,
  useQueryRefHandlers,
  useReactiveVar,
  useReadQuery,
  useSubscription,
  useSuspenseFragment,
  useSuspenseQuery,
} from "./hooks/index.js";

export type { IDocumentDefinition } from "./parser/index.js";
export { DocumentType, operationName, parser } from "./parser/index.js";

export type {
  PreloadQueryFetchPolicy,
  PreloadQueryFunction,
  PreloadQueryOptions,
} from "./query-preloader/createQueryPreloader.js";
export { createQueryPreloader } from "./query-preloader/createQueryPreloader.js";

export type {
  PreloadedQueryRef,
  QueryRef,
  QueryReference,
} from "./internal/index.js";

// These types will be removed with v5
export type {
  BackgroundQueryHookFetchPolicy,
  BackgroundQueryHookOptions,
  LazyQueryExecFunction,
  LazyQueryHookExecOptions,
  LazyQueryHookOptions,
  LazyQueryResult,
  LazyQueryResultTuple,
  LoadableQueryFetchPolicy,
  LoadableQueryHookOptions,
  LoadQueryFunction,
  MutationFunctionOptions,
  MutationHookOptions,
  MutationResult,
  MutationTuple,
  OnDataOptions,
  OnSubscriptionDataOptions,
  QueryHookOptions,
  QueryResult,
  SubscriptionHookOptions,
  SubscriptionResult,
  SuspenseQueryHookFetchPolicy,
  SuspenseQueryHookOptions,
  UseBackgroundQueryResult,
  UseFragmentOptions,
  UseFragmentResult,
  UseLoadableQueryResult,
  UseQueryRefHandlersResult,
  UseReadQueryResult,
  UseSuspenseFragmentOptions,
  UseSuspenseFragmentResult,
  UseSuspenseQueryResult,
} from "./types/deprecated.js";
