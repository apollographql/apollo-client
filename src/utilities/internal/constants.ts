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
 * Used to tell `ApolloCache.diff` whether to current result is an incremental
 * result. The cache is expected to return a well-formed `data` value where the
 * only holes in the data are at defer boundaries with `returnPartialData:
 *   false`. It is also expected to return a `dataState` property to provide
 * the state of data. Caches that use this symbol should set
 * `supportsIncrementalResults` to `true`.
 *
 * Meant for cache implementers only. This should not be used in userland code.
 */
export const incrementalInfoSymbol = Symbol.for("apollo.cache.incremental");
