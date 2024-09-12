import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

import type { FetchResult } from "../link/core/index.js";
import type {
  DefaultContext,
  MutationQueryReducersMap,
  OperationVariables,
  MutationUpdaterFunction,
  OnQueryUpdated,
  InternalRefetchQueriesInclude,
} from "./types.js";
import type { ApolloCache } from "../cache/index.js";
import type { ObservableQuery } from "./ObservableQuery.js";
import type { IgnoreModifier } from "../cache/core/types/common.js";

/**
 * fetchPolicy determines where the client may return a result from. The options are:
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
  | "no-cache"
  | "standby";

export type WatchQueryFetchPolicy = FetchPolicy | "cache-and-network";

export type MutationFetchPolicy = Extract<
  FetchPolicy,
  | "network-only" // default behavior (mutation results written to cache)
  | "no-cache" // alternate behavior (results not written to cache)
>;

export type RefetchWritePolicy = "merge" | "overwrite";

/**
 * errorPolicy determines the level of events for errors in the execution result. The options are:
 * - none (default): any errors from the request are treated like runtime errors and the observable is stopped
 * - ignore: errors from the request do not stop the observable, but also don't call `next`
 * - all: errors are treated like data and will notify observables
 */
export type ErrorPolicy = "none" | "ignore" | "all";

/**
 * Query options.
 */
export interface QueryOptions<TVariables = OperationVariables, TData = any> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#query:member} */
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: TVariables;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: FetchPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#pollInterval:member} */
  pollInterval?: number;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#notifyOnNetworkStatusChange:member} */
  notifyOnNetworkStatusChange?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
  returnPartialData?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#partialRefetch:member} */
  partialRefetch?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#canonizeResults:member} */
  canonizeResults?: boolean;
}

/**
 * Watched query options.
 */
export interface WatchQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
  TData = any,
> extends SharedWatchQueryOptions<TVariables, TData> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#query:member} */
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface SharedWatchQueryOptions<
  TVariables extends OperationVariables,
  TData,
> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: WatchQueryFetchPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#nextFetchPolicy:member} */
  nextFetchPolicy?:
    | WatchQueryFetchPolicy
    | ((
        this: WatchQueryOptions<TVariables, TData>,
        currentFetchPolicy: WatchQueryFetchPolicy,
        context: NextFetchPolicyContext<TData, TVariables>
      ) => WatchQueryFetchPolicy);

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#initialFetchPolicy:member} */
  initialFetchPolicy?: WatchQueryFetchPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
  refetchWritePolicy?: RefetchWritePolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: TVariables;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#pollInterval:member} */
  pollInterval?: number;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#notifyOnNetworkStatusChange:member} */
  notifyOnNetworkStatusChange?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
  returnPartialData?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#partialRefetch:member} */
  partialRefetch?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#canonizeResults:member} */
  canonizeResults?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skipPollAttempt:member} */
  skipPollAttempt?: () => boolean;
}

export interface NextFetchPolicyContext<
  TData,
  TVariables extends OperationVariables,
> {
  reason: "after-fetch" | "variables-changed";
  observable: ObservableQuery<TData, TVariables>;
  options: WatchQueryOptions<TVariables, TData>;
  initialFetchPolicy: WatchQueryFetchPolicy;
}

export interface FetchMoreQueryOptions<TVariables, TData = any> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#query:member} */
  query?: DocumentNode | TypedDocumentNode<TData, TVariables>;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: Partial<TVariables>;
  context?: DefaultContext;
}

export type UpdateQueryFn<
  TData = any,
  TSubscriptionVariables = OperationVariables,
  TSubscriptionData = TData,
> = (
  previousQueryResult: TData,
  options: {
    subscriptionData: { data: TSubscriptionData };
    variables?: TSubscriptionVariables;
  }
) => TData;

export type SubscribeToMoreOptions<
  TData = any,
  TSubscriptionVariables = OperationVariables,
  TSubscriptionData = TData,
> = {
  document:
    | DocumentNode
    | TypedDocumentNode<TSubscriptionData, TSubscriptionVariables>;
  variables?: TSubscriptionVariables;
  updateQuery?: UpdateQueryFn<TData, TSubscriptionVariables, TSubscriptionData>;
  onError?: (error: Error) => void;
  context?: DefaultContext;
};

export interface SubscriptionOptions<
  TVariables = OperationVariables,
  TData = any,
> {
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#query:member} */
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;

  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#variables:member} */
  variables?: TVariables;

  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: FetchPolicy;

  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;

  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#context:member} */
  context?: DefaultContext;

  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#extensions:member} */
  extensions?: Record<string, any>;
}

export interface MutationBaseOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> {
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#optimisticResponse:member} */
  optimisticResponse?:
    | TData
    | ((
        vars: TVariables,
        { IGNORE }: { IGNORE: IgnoreModifier }
      ) => TData | IgnoreModifier);

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#updateQueries:member} */
  updateQueries?: MutationQueryReducersMap<TData>;

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#refetchQueries:member} */
  refetchQueries?:
    | ((result: FetchResult<TData>) => InternalRefetchQueriesInclude)
    | InternalRefetchQueriesInclude;

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#awaitRefetchQueries:member} */
  awaitRefetchQueries?: boolean;

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#update:member} */
  update?: MutationUpdaterFunction<TData, TVariables, TContext, TCache>;

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onQueryUpdated:member} */
  onQueryUpdated?: OnQueryUpdated<any>;

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#variables:member} */
  variables?: TVariables;

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#context:member} */
  context?: TContext;
}

export interface MutationOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends MutationSharedOptions<TData, TVariables, TContext, TCache> {
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#mutation:member} */
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>;
}
export interface MutationSharedOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends MutationBaseOptions<TData, TVariables, TContext, TCache> {
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: MutationFetchPolicy;

  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#keepRootFields:member} */
  keepRootFields?: boolean;
}
