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
 * For use in Cache implementations only.
 * This should not be used in userland code.
 */
export const incrementalInfoSymbol = Symbol.for(
  "apollo.result.incrementalInfo"
);

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
 * changes the behavior of `returnPartialData: false` when handling a `@defer`
 * query where the result should contain a result if the only hole in the data
 * is at a `@defer` boundary. `dataState` should also be returned to signal what
 * state the data is in.
 *
 * When `handleIncrementalSymbol` is not provided, the cache should behave as it
 * does today.
 *
 * Caches that can handle incremental results need to opt-in by setting
 * `supportsIncrementalResults` to `true` as a property of the cache. This tells
 * the client whether to inject the symbol or not.
 *
 * Meant for cache implementers only. This should not be used in userland code.
 */
export const handleIncrementalSymbol = Symbol.for(
  "apollo.cache.handleIncremental"
);
