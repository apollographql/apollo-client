/**
 * The current status of a query’s execution in our system.
 */
export enum NetworkStatus {
  /**
   * The query has never been run before and the query is now currently running. A query will still
   * have this network status even if a partial data result was returned from the cache, but a
   * query was dispatched anyway.
   */
  loading = 1,

  /**
   * If `setVariables` was called and a query was fired because of that then the network status
   * will be `setVariables` until the result of that query comes back.
   */
  setVariables = 2,

  /**
   * Indicates that `fetchMore` was called on this query and that the query created is currently in
   * flight.
   */
  fetchMore = 3,

  /**
   * Similar to the `setVariables` network status. It means that `refetch` was called on a query
   * and the refetch request is currently in flight.
   */
  refetch = 4,

  /**
   * Indicates that a polling query is currently in flight. So for example if you are polling a
   * query every 10 seconds then the network status will switch to `poll` every 10 seconds whenever
   * a poll request has been sent but not resolved.
   */
  poll = 6,

  /**
   * No request is in flight for this query, and no errors happened. Everything is OK.
   */
  ready = 7,

  /**
   * No request is in flight for this query, but one or more errors were detected.
   */
  error = 8,
}

/**
 * Returns true if there is currently a network request in flight according to a given network
 * status.
 */
export function isNetworkRequestInFlight(
  networkStatus: NetworkStatus,
): boolean {
  return networkStatus < 7;
}
