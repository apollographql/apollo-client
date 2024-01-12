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
  /**
   * A GraphQL document that consists of a single query to be sent down to the
   * server.
   */
  // TODO REFACTOR: rename this to document. Didn't do it yet because it's in a
  // lot of tests.
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;

  /**
   * A map going from variable name to variable value, where the variables are used
   * within the GraphQL query.
   */
  variables?: TVariables;

  /**
   * Specifies the {@link ErrorPolicy} to be used for this query
   */
  errorPolicy?: ErrorPolicy;

  /**
   * Context to be passed to link execution chain
   */
  context?: DefaultContext;

  /**
   * Specifies the {@link FetchPolicy} to be used for this query
   */
  fetchPolicy?: FetchPolicy;

  /**
   * The time interval (in milliseconds) on which this query should be
   * refetched from the server.
   */
  pollInterval?: number;

  /**
   * Whether or not updates to the network status should trigger next on the observer of this query
   */
  notifyOnNetworkStatusChange?: boolean;

  /**
   * Allow returning incomplete data from the cache when a larger query cannot
   * be fully satisfied by the cache, instead of returning nothing.
   */
  returnPartialData?: boolean;

  /**
   * If `true`, perform a query `refetch` if the query result is marked as
   * being partial, and the returned data is reset to an empty Object by the
   * Apollo Client `QueryManager` (due to a cache miss).
   */
  partialRefetch?: boolean;

  /**
   * @deprecated
   * Using `canonizeResults` can result in memory leaks so we generally do not
   * recommend using this option anymore.
   * A future version of Apollo Client will contain a similar feature without
   * the risk of memory leaks.
   *
   * Whether to canonize cache results before returning them. Canonization
   * takes some extra time, but it speeds up future deep equality comparisons.
   * Defaults to false.
   */
  canonizeResults?: boolean;
}

/**
 * Watched query options.
 */
export interface WatchQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
  TData = any,
> extends SharedWatchQueryOptions<TVariables, TData> {
  /** {@inheritDoc @apollo/client!QueryOptions#query:member} */
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface SharedWatchQueryOptions<
  TVariables extends OperationVariables,
  TData,
> {
  /**
   * Specifies the {@link FetchPolicy} to be used for this query.
   */
  fetchPolicy?: WatchQueryFetchPolicy;

  /**
   * Specifies the {@link FetchPolicy} to be used after this query has completed.
   */
  nextFetchPolicy?:
    | WatchQueryFetchPolicy
    | ((
        this: WatchQueryOptions<TVariables, TData>,
        currentFetchPolicy: WatchQueryFetchPolicy,
        context: NextFetchPolicyContext<TData, TVariables>
      ) => WatchQueryFetchPolicy);

  /**
   * Defaults to the initial value of options.fetchPolicy, but can be explicitly
   * configured to specify the WatchQueryFetchPolicy to revert back to whenever
   * variables change (unless nextFetchPolicy intervenes).
   */
  initialFetchPolicy?: WatchQueryFetchPolicy;

  /**
   * Specifies whether a {@link NetworkStatus.refetch} operation should merge
   * incoming field data with existing data, or overwrite the existing data.
   * Overwriting is probably preferable, but merging is currently the default
   * behavior, for backwards compatibility with Apollo Client 3.x.
   */
  refetchWritePolicy?: RefetchWritePolicy;

  /** {@inheritDoc @apollo/client!QueryOptions#variables:member} */
  variables?: TVariables;

  /** {@inheritDoc @apollo/client!QueryOptions#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;

  /** {@inheritDoc @apollo/client!QueryOptions#context:member} */
  context?: DefaultContext;

  /** {@inheritDoc @apollo/client!QueryOptions#pollInterval:member} */
  pollInterval?: number;

  /** {@inheritDoc @apollo/client!QueryOptions#notifyOnNetworkStatusChange:member} */
  notifyOnNetworkStatusChange?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptions#returnPartialData:member} */
  returnPartialData?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptions#partialRefetch:member} */
  partialRefetch?: boolean;

  /** {@inheritDoc @apollo/client!QueryOptions#canonizeResults:member} */
  canonizeResults?: boolean;

  /**
   * A callback function that's called whenever a refetch attempt occurs
   * while polling. If the function returns `true`, the refetch is
   * skipped and not reattempted until the next poll interval.
   */
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
  query?: DocumentNode | TypedDocumentNode<TData, TVariables>;
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
  /**
   * A GraphQL document, often created with `gql` from the `graphql-tag`
   * package, that contains a single subscription inside of it.
   */
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;

  /**
   * An object that maps from the name of a variable as used in the subscription
   * GraphQL document to that variable's value.
   */
  variables?: TVariables;

  /**
   * Specifies the {@link FetchPolicy} to be used for this subscription.
   */
  fetchPolicy?: FetchPolicy;

  /**
   * Specifies the {@link ErrorPolicy} to be used for this operation
   */
  errorPolicy?: ErrorPolicy;

  /**
   * Context object to be passed through the link execution chain.
   */
  context?: DefaultContext;
}

export interface MutationBaseOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> {
  /**
   * By providing either an object or a callback function that, when invoked after
   * a mutation, allows you to return optimistic data and optionally skip updates
   * via the `IGNORE` sentinel object, Apollo Client caches this temporary
   * (and potentially incorrect) response until the mutation completes, enabling
   * more responsive UI updates.
   *
   * For more information, see [Optimistic mutation results](/react/performance/optimistic-ui/).
   */
  optimisticResponse?:
    | TData
    | ((vars: TVariables, { IGNORE }: { IGNORE: IgnoreModifier }) => TData);

  /**
   * A {@link MutationQueryReducersMap}, which is map from query names to
   * mutation query reducers. Briefly, this map defines how to incorporate the
   * results of the mutation into the results of queries that are currently
   * being watched by your application.
   */
  updateQueries?: MutationQueryReducersMap<TData>;

  /**
   * An array (or a function that _returns_ an array) that specifies which queries you want to refetch after the mutation occurs.
   *
   * Each array value can be either:
   *
   * - An object containing the `query` to execute, along with any `variables`
   *
   * - A string indicating the operation name of the query to refetch
   */
  refetchQueries?:
    | ((result: FetchResult<TData>) => InternalRefetchQueriesInclude)
    | InternalRefetchQueriesInclude;

  /**
   * If `true`, makes sure all queries included in `refetchQueries` are completed before the mutation is considered complete.
   *
   * The default value is `false` (queries are refetched asynchronously).
   */
  awaitRefetchQueries?: boolean;

  /**
   * A function used to update the Apollo Client cache after the mutation completes.
   *
   * For more information, see [Updating the cache after a mutation](/react/data/mutations#updating-the-cache-after-a-mutation).
   */
  update?: MutationUpdaterFunction<TData, TVariables, TContext, TCache>;

  /**
   * Optional callback for intercepting queries whose cache data has been updated by the mutation, as well as any queries specified in the [`refetchQueries: [...]`](#refetchQueries) list passed to `client.mutate`.
   *
   * Returning a `Promise` from `onQueryUpdated` will cause the final mutation `Promise` to await the returned `Promise`. Returning `false` causes the query to be ignored.
   */
  onQueryUpdated?: OnQueryUpdated<any>;

  /**
   * Specifies how the mutation handles a response that returns both GraphQL errors and partial results.
   *
   * For details, see [GraphQL error policies](/react/data/error-handling/#graphql-error-policies).
   *
   * The default value is `none`, meaning that the mutation result includes error details but _not_ partial results.
   */
  errorPolicy?: ErrorPolicy;

  /**
   * An object containing all of the GraphQL variables your mutation requires to execute.
   *
   * Each key in the object corresponds to a variable name, and that key's value corresponds to the variable value.
   */
  variables?: TVariables;

  /**
   * If you're using [Apollo Link](/react/api/link/introduction/), this object is the initial value of the `context` object that's passed along your link chain.
   */
  context?: TContext;
}

export interface MutationOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends MutationSharedOptions<TData, TVariables, TContext, TCache> {
  /**
   * A GraphQL document, often created with `gql` from the `graphql-tag`
   * package, that contains a single mutation inside of it.
   */
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>;
}
export interface MutationSharedOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends MutationBaseOptions<TData, TVariables, TContext, TCache> {
  /**
   * Provide `no-cache` if the mutation's result should _not_ be written to the Apollo Client cache.
   * The default value is `network-only` (which means the result _is_ written to the cache).
   * Unlike queries, mutations _do not_ support [fetch policies](/react/data/queries/#setting-a-fetch-policy) besides `network-only` and `no-cache`.
   */
  fetchPolicy?: MutationFetchPolicy;

  /**
   * To avoid retaining sensitive information from mutation root field
   * arguments, Apollo Client v3.4+ automatically clears any `ROOT_MUTATION`
   * fields from the cache after each mutation finishes. If you need this
   * information to remain in the cache, you can prevent the removal by passing
   * `keepRootFields: true` to the mutation. `ROOT_MUTATION` result data are
   * also passed to the mutation `update` function, so we recommend obtaining
   * the results that way, rather than using this option, if possible.
   */
  keepRootFields?: boolean;
}
