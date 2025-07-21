import type { ApolloCache } from "@apollo/client";

/** @deprecated Use `ApolloCache.WatchFragmentOptions` instead */
export type WatchFragmentOptions<TData, TVariables> =
  ApolloCache.WatchFragmentOptions<TData, TVariables>;

/** @deprecated Use `ApolloCache.WatchFragmentResult` instead */
export type WatchFragmentResult<TData> = ApolloCache.WatchFragmentResult<TData>;
