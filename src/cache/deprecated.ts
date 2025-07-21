import type { ApolloCache, OperationVariables } from "@apollo/client";

/** @deprecated Use `ApolloCache.WatchFragmentOptions` instead */
export type WatchFragmentOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = ApolloCache.WatchFragmentOptions<TData, TVariables>;

/** @deprecated Use `ApolloCache.WatchFragmentResult` instead */
export type WatchFragmentResult<TData> = ApolloCache.WatchFragmentResult<TData>;
