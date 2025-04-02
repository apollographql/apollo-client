export type { ApolloContextValue } from "@apollo/client/react/context";
export {
  ApolloConsumer,
  ApolloProvider,
  getApolloContext,
} from "@apollo/client/react/context";

export type { SkipToken } from "@apollo/client/react/hooks";
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
} from "@apollo/client/react/hooks";

export type { IDocumentDefinition } from "@apollo/client/react/parser";
export {
  DocumentType,
  operationName,
  parser,
} from "@apollo/client/react/parser";

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
} from "@apollo/client/react/internal";

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
