import type { ApolloCache } from "@apollo/client/cache";

import type { ApolloClient } from "./ApolloClient.js";
import type { ObservableQuery } from "./ObservableQuery.js";
import type { DataState, OperationVariables } from "./types.js";

/** @deprecated Use `ApolloClient.Options` instead */
export type ApolloClientOptions = ApolloClient.Options;

/** @deprecated Use `ObservableQuery.Result` instead */
export type ApolloQueryResult<
  TData,
  TStates extends DataState<TData>["dataState"] = DataState<TData>["dataState"],
> = ObservableQuery.Result<TData, TStates>;

/** @deprecated Use `ApolloClient.DefaultOptions` instead */
export type DefaultOptions = ApolloClient.DefaultOptions;

/** @deprecated Use `ApolloClient.DevtoolsOptions` instead */
export type DevtoolsOptions = ApolloClient.DevtoolsOptions;

/** @deprecated Use `ApolloClient.MutateOptions` instead */
export type MutationOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TCache extends ApolloCache = ApolloCache,
> = ApolloClient.MutateOptions<TData, TVariables, TCache>;

/** @deprecated Use `ApolloClient.MutateResult` instead */
export type MutateResult<TData = unknown> = ApolloClient.MutateResult<TData>;

/** @deprecated Use `ApolloClient.QueryOptions` instead */
export type QueryOptions<
  TVariables extends OperationVariables = OperationVariables,
  // eslint-disable-next-line local-rules/tdata-tvariables-order
  TData = unknown,
> = ApolloClient.QueryOptions<TData, TVariables>;

/** @deprecated Use `ApolloClient.RefetchQueriesOptions` instead */
export type RefetchQueriesOptions<
  TCache extends ApolloCache,
  TResult,
> = ApolloClient.RefetchQueriesOptions<TCache, TResult>;

/** @deprecated Use `ApolloClient.RefetchQueriesResult` instead */
export type RefetchQueriesResult<TResult> =
  ApolloClient.RefetchQueriesResult<TResult>;

/** @deprecated Use `ObservableQuery.SubscribeToMoreOptions` instead */
export type SubscribeToMoreOptions<
  // eslint-disable-next-line local-rules/tdata-tvariables-order
  TData = unknown,
  TSubscriptionVariables extends OperationVariables = OperationVariables,
  TSubscriptionData = TData,
  TVariables extends OperationVariables = TSubscriptionVariables,
> = ObservableQuery.SubscribeToMoreOptions<
  TData,
  TSubscriptionVariables,
  TSubscriptionData,
  TVariables
>;

/** @deprecated Use `ApolloClient.SubscribeOptions` instead */
export type SubscriptionOptions<
  TVariables extends OperationVariables = OperationVariables,
  // eslint-disable-next-line local-rules/tdata-tvariables-order
  TData = unknown,
> = ApolloClient.SubscribeOptions<TData, TVariables>;

/** @deprecated Use `ApolloClient.WatchQueryOptions` instead */
export type WatchQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
  // eslint-disable-next-line local-rules/tdata-tvariables-order
  TData = unknown,
> = ApolloClient.WatchQueryOptions<TData, TVariables>;
