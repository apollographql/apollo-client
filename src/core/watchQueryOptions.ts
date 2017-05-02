import {
  DocumentNode,
  FragmentDefinitionNode,
} from 'graphql';

import {
  OperationResultReducer,
  MutationQueryReducersMap,
} from '../data/mutationResults';

import {
  DataProxy,
} from '../data/proxy';

import {
  PureQueryOptions,
} from './types';

/**
 * fetchPolicy determines where the client may return a result from. The options are:
 * - cache-first (default): return result from cache. Only fetch from network if cached result is not available.
 * - cache-and-network: returns result from cache first (if it exists), then return network result once it's available
 * - cache-only: return result from cache if avaiable, fail otherwise.
 * - network-only: return result from network, fail if network call doesn't succeed.
 * - standby: only for queries that aren't actively watched, but should be available for refetch and updateQueries.
 */

export type FetchPolicy = 'cache-first' | 'cache-and-network' | 'network-only' | 'cache-only' | 'standby';

/**
 * We can change these options to an ObservableQuery
 */
export interface ModifiableWatchQueryOptions {
  /**
   * A map going from variable name to variable value, where the variables are used
   * within the GraphQL query.
   */
  variables?: { [key: string]: any };

  /**
   * The time interval (in milliseconds) on which this query should be
   * refetched from the server.
   */
  pollInterval?: number;

  /**
   * Specifies the {@link FetchPolicy} to be used for this query
   */
  fetchPolicy?: FetchPolicy;

  /**
   * Whether or not updates to the network status should trigger next on the observer of this query
   */
  notifyOnNetworkStatusChange?: boolean;

  /**
   * A redux reducer that lets you update the result of this query in the store based on any action (including mutation and query results)
   */
  reducer?: OperationResultReducer;
}

/**
 * The argument to a query
 */
export interface WatchQueryOptions extends ModifiableWatchQueryOptions {
  /**
   * A GraphQL document that consists of a single query to be sent down to the
   * server.
   */
  // TODO REFACTOR: rename this to document. Didn't do it yet because it's in a lot of tests.
  query: DocumentNode;

  /**
   * Arbitrary metadata stored in Redux with this query.  Designed for debugging,
   * developer tools, etc.
   */
  metadata?: any;
}

export interface FetchMoreQueryOptions {
  query?: DocumentNode;
  variables?: { [key: string]: any };
}

export type SubscribeToMoreOptions = {
  document: DocumentNode;
  variables?: { [key: string]: any };
  updateQuery?: (previousQueryResult: Object, options: {
    subscriptionData: { data: any },
    variables: { [key: string]: any },
  }) => Object;
  onError?: (error: Error) => void;
};

export interface SubscriptionOptions {
  query: DocumentNode;
  variables?: { [key: string]: any };
}

export interface MutationOptions {
  /**
   * A GraphQL document, often created with `gql` from the `graphql-tag`
   * package, that contains a single mutation inside of it.
   */
  mutation: DocumentNode;

  /**
   * An object that maps from the name of a variable as used in the mutation
   * GraphQL document to that variable's value.
   */
  variables?: Object;

  /**
   * An object that represents the result of this mutation that will be
   * optimistically stored before the server has actually returned a result.
   * This is most often used for optimistic UI, where we want to be able to see
   * the result of a mutation immediately, and update the UI later if any errors
   * appear.
   */
  optimisticResponse?: Object;

  /**
   * A {@link MutationQueryReducersMap}, which is map from query names to
   * mutation query reducers. Briefly, this map defines how to incorporate the
   * results of the mutation into the results of queries that are currently
   * being watched by your application.
   */
  updateQueries?: MutationQueryReducersMap;

  /**
   * A list of query names which will be refetched once this mutation has
   * returned. This is often used if you have a set of queries which may be
   * affected by a mutation and will have to update. Rather than writing a
   * mutation query reducer (i.e. `updateQueries`) for this, you can simply
   * refetch the queries that will be affected and achieve a consistent store
   * once these queries return.
   */
  refetchQueries?: string[] | PureQueryOptions[];

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
  update?: MutationUpdaterFn;
}

// Add a level of indirection for `typedoc`.
export type MutationUpdaterFn = (proxy: DataProxy, mutationResult: Object) => void;
