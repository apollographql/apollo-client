import type {
  ApolloCache,
  DefaultContext,
  OperationVariables,
} from "@apollo/client";

import type { useBackgroundQuery } from "../hooks/useBackgroundQuery.js";
import type { useFragment } from "../hooks/useFragment.js";
import type { useLazyQuery } from "../hooks/useLazyQuery.js";
import type { useLoadableQuery } from "../hooks/useLoadableQuery.js";
import type { useMutation } from "../hooks/useMutation.js";
import type { useQuery } from "../hooks/useQuery.js";
import type { useQueryRefHandlers } from "../hooks/useQueryRefHandlers.js";
import type { useReadQuery } from "../hooks/useReadQuery.js";
import type { useSubscription } from "../hooks/useSubscription.js";
import type { useSuspenseFragment } from "../hooks/useSuspenseFragment.js";
import type { useSuspenseQuery } from "../hooks/useSuspenseQuery.js";

/** @deprecated Use `useQuery.Options` instead */
export type QueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useQuery.Options<TData, TVariables>;

/** @deprecated Use `useQuery.Result` instead */
export type QueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useQuery.Result<TData, TVariables>;

/** @deprecated Use `useLazyQuery.Options` instead */
export type LazyQueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.Options<TData, TVariables>;

/** @deprecated Use `useLazyQuery.Result` instead */
export type LazyQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.Result<TData, TVariables>;

/** @deprecated Use `useLazyQuery.ResultTuple` instead */
export type LazyQueryResultTuple<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.ResultTuple<TData, TVariables>;

/** @deprecated Use `useLazyQuery.ExecOptions` instead */
export type LazyQueryHookExecOptions<
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.ExecOptions<TVariables>;

/** @deprecated Use `useLazyQuery.ExecOptions` instead */
export type LazyQueryExecFunction<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.ExecFunction<TData, TVariables>;

/** @deprecated Use `useMutation.Options` instead */
export type MutationHookOptions<
  TData = unknown,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache = ApolloCache,
> = useMutation.Options<TData, TVariables, TContext, TCache>;

/** @deprecated Use `useMutation.Result` instead */
export type MutationResult<TData = unknown> = useMutation.Result<TData>;

/** @deprecated Use `useMutation.MutationFunctionOptions` instead */
export type MutationFunctionOptions<
  TData = unknown,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache = ApolloCache,
> = useMutation.MutationFunctionOptions<TData, TVariables, TContext, TCache>;

/** @deprecated Use `useMutation.ResultTuple` instead */
export type MutationTuple<
  TData,
  TVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache = ApolloCache,
> = useMutation.ResultTuple<TData, TVariables, TContext, TCache>;

/** @deprecated Use `useSubscription.Result` instead */
export type SubscriptionResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useSubscription.Result<TData>;

/** @deprecated Use `useSubscription.Options` instead */
export type SubscriptionHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useSubscription.Options<TData, TVariables>;

/** @deprecated Use `useSubscription.OnDataOptions` instead */
export type OnDataOptions<TData = unknown> =
  useSubscription.OnDataOptions<TData>;

/** @deprecated Use `useSubscription.OnSubscriptionDataOptions` instead */
export type OnSubscriptionDataOptions<TData = unknown> =
  useSubscription.OnSubscriptionDataOptions<TData>;

/** @deprecated Use `useFragment.Options` instead */
export type UseFragmentOptions<TData, TVariables> = useFragment.Options<
  TData,
  TVariables
>;

/** @deprecated Use `useFragment.Result` instead */
export type UseFragmentResult<TData> = useFragment.Result<TData>;

/** @deprecated Use `useSuspenseQuery.Options` instead */
export type SuspenseQueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useSuspenseQuery.Options<TVariables>;

/** @deprecated Use `useSuspenseQuery.Result` instead */
export type UseSuspenseQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useSuspenseQuery.Result<TData, TVariables>;

/** @deprecated Use `useSuspenseQuery.FetchPolicy` instead */
export type SuspenseQueryHookFetchPolicy = useSuspenseQuery.FetchPolicy;

/** @deprecated Use `useBackgroundQuery.Options` instead */
export type BackgroundQueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useBackgroundQuery.Options<TVariables>;

/** @deprecated Use `useBackgroundQuery.Result` instead */
export type UseBackgroundQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useBackgroundQuery.Result<TData, TVariables>;

/** @deprecated Use `useBackgroundQuery.FetchPolicy` instead */
export type BackgroundQueryHookFetchPolicy = useBackgroundQuery.FetchPolicy;

/** @deprecated Use `useSuspenseFragment.Options` instead */
export type UseSuspenseFragmentOptions<
  TData,
  TVariables extends OperationVariables,
> = useSuspenseFragment.Options<TData, TVariables>;

/** @deprecated Use `useSuspenseFragment.Result` instead */
export type UseSuspenseFragmentResult<TData> =
  useSuspenseFragment.Result<TData>;

/** @deprecated Use `useLoadableQuery.LoadQueryFunction` instead */
export type LoadQueryFunction<TVariables extends OperationVariables> =
  useLoadableQuery.LoadQueryFunction<TVariables>;

/** @deprecated Use `useLoadableQuery.FetchPolicy` instead */
export type LoadableQueryFetchPolicy = useLoadableQuery.FetchPolicy;

/** @deprecated Use `useLoadableQuery.Options` instead */
export type LoadableQueryHookOptions = useLoadableQuery.Options;

/** @deprecated Use `useLoadableQuery.Result` instead */
export type UseLoadableQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLoadableQuery.Result<TData, TVariables>;

/** @deprecated Use `useQueryRefHandlers.Result` instead */
export type UseQueryRefHandlersResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useQueryRefHandlers.Result<TData, TVariables>;

/** @deprecated Use `useReadQuery.Result` instead */
export type UseReadQueryResult<TData = unknown> = useReadQuery.Result<TData>;
