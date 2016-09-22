import {
  Document,
  FragmentDefinition,
} from 'graphql';

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
   * Specifies whether the client should diff the query against the cache and only
   * fetch the portions of it that aren't already available (it does this when forceFetch is
   * false) or it should just fetch the entire query from the server and update the cache
   * accordingly (it does this when forceFetch is true).
   */
  forceFetch?: boolean;
  /**
   * This specifies whether {@link Observer} instances for this query
   * should be updated with partial results. For example, when a portion of a query can be resolved
   * entirely from the cache, that result will be delivered to the Observer first and the
   * rest of the result (as provided by the server) will be returned later.
   */
  returnPartialData?: boolean;
  /**
   * If this is set to true, the query is resolved *only* within information
   * available in the cache (i.e. we never hit the server). If a particular field is not available
   * in the cache, it will not be available in the result.
   */
  noFetch?: boolean;
  /**
   * The time interval (in milliseconds) on which this query should be
   * refetched from the server.
   */
  pollInterval?: number;
}

/**
 * The argument to a query
 */
export interface WatchQueryOptions extends ModifiableWatchQueryOptions {
  /**
   * A GraphQL document that consists of a single query to be sent down to the
   * server.
   */
  query: Document;

  /**
   * A list of fragments that are returned by {@link createFragment} which can be
   * referenced from the query document.
   */
  fragments?: FragmentDefinition[];
}

export interface FetchMoreQueryOptions {
  query?: Document;
  variables?: { [key: string]: any };
}

export interface GraphQLSubscriptionOptions {
  subscription: Document;
  variables?: { [key: string]: any };
  fragments?: FragmentDefinition[];
  updateQuery: (previousQueryResult: Object, options: {
    subscriptionResult: Object,
    queryVariables: Object,
  }) => Object;
};
