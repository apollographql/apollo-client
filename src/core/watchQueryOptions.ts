import type { Unmasked } from "@apollo/client/masking";
import type { DeepPartial } from "@apollo/client/utilities";

import type { ApolloClient } from "./ApolloClient.js";
import type { ObservableQuery } from "./ObservableQuery.js";
import type { OperationVariables } from "./types.js";

/**
 * fetchPolicy determines where the client may return a result from. The options are:
 *
 * - cache-first (default): return result from cache. Only fetch from network if cached result is not available.
 * - cache-and-network: return result from cache first (if it exists), then return network result once it's available.
 * - cache-only: return result from cache if available, fail otherwise.
 * - no-cache: return result from network, fail if network call doesn't succeed, don't save to cache
 * - network-only: return result from network, fail if network call doesn't succeed, save to cache
 * - standby: only for queries that aren't actively watched, but should be available for refetch and updateQueries.
 */
export type FetchPolicy =
  | "cache-first"
  | "network-only"
  | "cache-only"
  | "no-cache";

export type WatchQueryFetchPolicy =
  | FetchPolicy
  | "cache-and-network"
  | "standby";

export type MutationFetchPolicy = Extract<
  FetchPolicy,
  | "network-only" // default behavior (mutation results written to cache)
  | "no-cache" // alternate behavior (results not written to cache)
>;

export type RefetchWritePolicy = "merge" | "overwrite";

/**
 * errorPolicy determines the level of events for errors in the execution result. The options are:
 *
 * - none (default): any errors from the request are treated like runtime errors and the observable is stopped
 * - ignore: errors from the request do not stop the observable, but also don't call `next`
 * - all: errors are treated like data and will notify observables
 */
export type ErrorPolicy = "none" | "ignore" | "all";

export interface NextFetchPolicyContext<
  TData,
  TVariables extends OperationVariables,
> {
  reason: "after-fetch" | "variables-changed";
  observable: ObservableQuery<TData, TVariables>;
  options: ApolloClient.WatchQueryOptions<TData, TVariables>;
  initialFetchPolicy: WatchQueryFetchPolicy;
}

export type UpdateQueryOptions<TData, TVariables extends OperationVariables> = {
  variables?: TVariables;
} & (
  | {
      /**
       * Indicate if the previous query result has been found fully in the cache.
       */
      complete: true;
      previousData: Unmasked<TData>;
    }
  | {
      /**
       * Indicate if the previous query result has not been found fully in the cache.
       * Might have partial or missing data.
       */
      complete: false;
      previousData: DeepPartial<Unmasked<TData>> | undefined;
    }
);

export interface UpdateQueryMapFn<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  (
    /**
     * @deprecated This value is not type-safe and may contain partial data. This
     * argument will be removed in Apollo Client v5. Use `options.previousData`
     * instead for a more type-safe value.
     */
    unsafePreviousData: DeepPartial<Unmasked<TData>>,
    options: UpdateQueryOptions<TData, TVariables>
  ): Unmasked<TData> | void;
}

export type SubscribeToMoreUpdateQueryFn<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TSubscriptionData = TData,
> = {
  (
    /**
     * @deprecated This value is not type-safe and may contain partial data. This
     * argument will be removed in Apollo Client v5. Use `options.previousData`
     * instead for a more type-safe value.
     */
    unsafePreviousData: DeepPartial<Unmasked<TData>>,
    options: UpdateQueryOptions<TData, TVariables> & {
      subscriptionData: { data: Unmasked<TSubscriptionData> };
    }
  ): Unmasked<TData> | void;
};

export interface SubscribeToMoreFunction<
  TData,
  TVariables extends OperationVariables = OperationVariables,
> {
  <
    TSubscriptionData = TData,
    TSubscriptionVariables extends OperationVariables = TVariables,
  >(
    options: ObservableQuery.SubscribeToMoreOptions<
      TData,
      TSubscriptionVariables,
      TSubscriptionData,
      TVariables
    >
  ): () => void;
}
