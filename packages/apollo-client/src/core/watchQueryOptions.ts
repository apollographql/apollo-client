import { DocumentNode, ExecutionResult } from 'graphql';
import { FetchResult } from 'apollo-link';
import { DataProxy } from 'apollo-cache';

import { MutationQueryReducersMap } from './types';

import { PureQueryOptions, OperationVariables } from './types';

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
  | 'cache-first'
  | 'cache-and-network'
  | 'network-only'
  | 'cache-only'
  | 'no-cache'
  | 'standby';

/**
 * errorPolicy determines the level of events for errors in the execution result. The options are:
 * - none (default): any errors from the request are treated like runtime errors and the observable is stopped (XXX this is default to lower breaking changes going from AC 1.0 => 2.0)
 * - ignore: errors from the request do not stop the observable, but also don't call `next`
 * - all: errors are treated like data and will notify observables
 */

export type ErrorPolicy = 'none' | 'ignore' | 'all';

/**
 * Common options shared across all query interfaces.
 */
export interface QueryBaseOptions<TVariables = OperationVariables> {
  /**
   * A map going from variable name to variable value, where the variables are used
   * within the GraphQL query.
   */
  variables?: TVariables;

  /**
   * Specifies the {@link FetchPolicy} to be used for this query
   */
  fetchPolicy?: FetchPolicy;

  /**
   * Specifies the {@link ErrorPolicy} to be used for this query
   */
  errorPolicy?: ErrorPolicy;

  /**
   * Whether or not to fetch results
   */
  fetchResults?: boolean;
}

/**
 * Query options.
 */
export interface QueryOptions<TVariables = OperationVariables>
  extends QueryBaseOptions<TVariables> {
  /**
   * A GraphQL document that consists of a single query to be sent down to the
   * server.
   */
  // TODO REFACTOR: rename this to document. Didn't do it yet because it's in a
  // lot of tests.
  query: DocumentNode;

  /**
   * Arbitrary metadata stored in the store with this query.  Designed for debugging,
   * developer tools, etc.
   */
  metadata?: any;

  /**
   * Context to be passed to link execution chain
   */
  context?: any;
}

/**
 * We can change these options to an ObservableQuery
 */
export interface ModifiableWatchQueryOptions<TVariables = OperationVariables>
  extends QueryBaseOptions<TVariables> {
  /**
   * The time interval (in milliseconds) on which this query should be
   * refetched from the server.
   */
  pollInterval?: number;

  /**
   * Whether or not updates to the network status should trigger next on the observer of this query
   */
  notifyOnNetworkStatusChange?: boolean;
}

/**
 * Watched query options.
 */
export interface WatchQueryOptions<TVariables = OperationVariables>
  extends QueryOptions<TVariables>,
    ModifiableWatchQueryOptions<TVariables> {}

export interface FetchMoreQueryOptions<TVariables, K extends keyof TVariables> {
  query?: DocumentNode;
  variables?: Pick<TVariables, K>;
}

export type UpdateQueryFn<TData = any, TVariables = OperationVariables> = (
  previousQueryResult: TData,
  options: {
    subscriptionData: { data: TData };
    variables?: TVariables;
  },
) => TData;

export type SubscribeToMoreOptions<
  TData = any,
  TVariables = OperationVariables
> = {
  document: DocumentNode;
  variables?: TVariables;
  updateQuery?: UpdateQueryFn<TData, TVariables>;
  onError?: (error: Error) => void;
};

export interface SubscriptionOptions<TVariables = OperationVariables> {
  /**
   * A GraphQL document, often created with `gql` from the `graphql-tag`
   * package, that contains a single subscription inside of it.
   */
  query: DocumentNode;

  /**
   * An object that maps from the name of a variable as used in the subscription
   * GraphQL document to that variable's value.
   */
  variables?: TVariables;
}

export type RefetchQueryDescription = Array<string | PureQueryOptions>;

export interface MutationBaseOptions<
  T = { [key: string]: any },
  TVariables = OperationVariables
> {
  /**
   * An object that represents the result of this mutation that will be
   * optimistically stored before the server has actually returned a result.
   * This is most often used for optimistic UI, where we want to be able to see
   * the result of a mutation immediately, and update the UI later if any errors
   * appear.
   */
  optimisticResponse?: Object | Function;

  /**
   * A {@link MutationQueryReducersMap}, which is map from query names to
   * mutation query reducers. Briefly, this map defines how to incorporate the
   * results of the mutation into the results of queries that are currently
   * being watched by your application.
   */
  updateQueries?: MutationQueryReducersMap<T>;

  /**
   * A list of query names which will be refetched once this mutation has
   * returned. This is often used if you have a set of queries which may be
   * affected by a mutation and will have to update. Rather than writing a
   * mutation query reducer (i.e. `updateQueries`) for this, you can simply
   * refetch the queries that will be affected and achieve a consistent store
   * once these queries return.
   */
  refetchQueries?:
    | ((result: ExecutionResult) => RefetchQueryDescription)
    | RefetchQueryDescription;

  /**
   * By default, `refetchQueries` does not wait for the refetched queries to
   * be completed, before resolving the mutation `Promise`. This ensures that
   * query refetching does not hold up mutation response handling (query
   * refetching is handled asynchronously). Set `awaitRefetchQueries` to
   * `true` if you would like to wait for the refetched queries to complete,
   * before the mutation can be marked as resolved.
   */
  awaitRefetchQueries?: boolean;

  /**
   * A function which provides a {@link DataProxy} and the result of the
   * mutation to allow the user to update the store based on the results of the
   * mutation.
   *
   * This function will be called twice over the lifecycle of a mutation. Once
   * at the very beginning if an `optimisticResponse` was provided. The writes
   * created from the optimistic data will be rolled back before the second time
   * this function is called which is when the mutation has succesfully
   * resolved. At that point `update` will be called with the *actual* mutation
   * result and those writes will not be rolled back.
   *
   * The reason a {@link DataProxy} is provided instead of the user calling the
   * methods directly on {@link ApolloClient} is that all of the writes are
   * batched together at the end of the update, and it allows for writes
   * generated by optimistic data to be rolled back.
   */
  update?: MutationUpdaterFn<T>;

  /**
   * Specifies the {@link ErrorPolicy} to be used for this operation
   */
  errorPolicy?: ErrorPolicy;

  /**
   * An object that maps from the name of a variable as used in the mutation
   * GraphQL document to that variable's value.
   */
  variables?: TVariables;
}

export interface MutationOptions<
  T = { [key: string]: any },
  TVariables = OperationVariables
> extends MutationBaseOptions<T, TVariables> {
  /**
   * A GraphQL document, often created with `gql` from the `graphql-tag`
   * package, that contains a single mutation inside of it.
   */
  mutation: DocumentNode;

  /**
   * The context to be passed to the link execution chain. This context will
   * only be used with the mutation. It will not be used with
   * `refetchQueries`. Refetched queries use the context they were
   * initialized with (since the intitial context is stored as part of the
   * `ObservableQuery` instance). If a specific context is needed when
   * refetching queries, make sure it is configured (via the
   * [`query` `context` option](/docs/react/api/apollo-client.html#ApolloClient.query))
   * when the query is first initialized/run.
   */
  context?: any;

  /**
   * Specifies the {@link FetchPolicy} to be used for this query
   */
  fetchPolicy?: FetchPolicy;
}

// Add a level of indirection for `typedoc`.
export type MutationUpdaterFn<T = { [key: string]: any }> = (
  proxy: DataProxy,
  mutationResult: FetchResult<T>,
) => void;
