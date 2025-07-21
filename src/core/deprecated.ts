import type { ApolloClient } from "./ApolloClient.js";
import type { OperationVariables } from "./types.js";

/** @deprecated Use `ApolloClient.Options` instead */
export type ApolloClientOptions = ApolloClient.Options;

/** @deprecated Use `ApolloClient.DevtoolsOptions` instead */
export type DevtoolsOptions = ApolloClient.DevtoolsOptions;

/** @deprecated Use `ApolloClient.QueryOptions` instead */
export type QueryOptions<
  TVariables extends OperationVariables = OperationVariables,
  TData = unknown,
> = ApolloClient.QueryOptions<TData, TVariables>;

/** @deprecated Use `ApolloClient.WatchQueryOptions` instead */
export type WatchQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
  TData = unknown,
> = ApolloClient.WatchQueryOptions<TData, TVariables>;
