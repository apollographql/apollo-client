export type { ApolloContextValue } from "./context/ApolloContext.js";
export { ApolloConsumer } from "./context/ApolloConsumer.js";
export { getApolloContext } from "./context/ApolloContext.js";
export { ApolloProvider } from "./context/ApolloProvider.js";

export { useApolloClient } from "./hooks/useApolloClient.js";
export { useLazyQuery } from "./hooks/useLazyQuery.js";
export { useMutation } from "./hooks/useMutation.js";
export { useQuery } from "./hooks/useQuery.js";
export { useSubscription } from "./hooks/useSubscription.js";
export { useReactiveVar } from "./hooks/useReactiveVar.js";
export { useFragment } from "./hooks/useFragment.js";
export { useSuspenseQuery } from "./hooks/useSuspenseQuery.js";
export { useBackgroundQuery } from "./hooks/useBackgroundQuery.js";
export { useSuspenseFragment } from "./hooks/useSuspenseFragment.js";
export { useLoadableQuery } from "./hooks/useLoadableQuery.js";
export { useQueryRefHandlers } from "./hooks/useQueryRefHandlers.js";
export { useReadQuery } from "./hooks/useReadQuery.js";
export { skipToken } from "./hooks/constants.js";
export type { SkipToken } from "./hooks/constants.js";

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
