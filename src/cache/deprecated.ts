import type { ApolloCache } from "@apollo/client";

/** @deprecated Use `ApolloCache.WatchFragmentOptions` instead */
export type WatchFragmentOptions<TData, TVars> =
  ApolloCache.WatchFragmentOptions<TData, TVars>;

/** @deprecated Use `ApolloCache.WatchFragmentResult` instead */
export type WatchFragmentResult<TData> = ApolloCache.WatchFragmentResult<TData>;
