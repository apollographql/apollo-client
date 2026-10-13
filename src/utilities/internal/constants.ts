/**
 * @internal
 * Used to set `extensions` on the GraphQL result without exposing it
 * unnecessarily. Only use internally!
 */
export const extensionsSymbol = Symbol.for("apollo.result.extensions");

/**
 * For use in Cache implementations only.
 * This should not be used in userland code.
 */
export const streamInfoSymbol = Symbol.for("apollo.result.streamInfo");

/**
 * @internal
 * Used as key for `ApolloClient.WatchQueryOptions`.
 *
 * Meant for framework integrators only!
 */
export const variablesUnknownSymbol = Symbol.for(
  "apollo.observableQuery.variablesUnknown"
);

/**
 * @internal
 * Used to tell `ApolloCache.diff` whether to handle incremental results. This
 * changes the behavior of `returnPartialData: false` when handling incremental
 * queries with partial or empty data at a `@defer` or `@stream` boundary. This
 * also signals to the cache that it should return a data state.
 *
 * When `handleIncrementalSymbol` is not provided, the cache should behave as it
 * does today.
 *
 * 3rd party caches that want to implement this behavior should talk to the
 * Apollo Client team. Open a GitHub issue so we can chat with you on what is
 * required for this to work in Apollo Client version 4.x.
 *
 * Meant for cache implementers only. This should not be used in userland code.
 */
export const handleIncrementalSymbol = Symbol.for(
  "apollo.cache.handleIncremental"
);
