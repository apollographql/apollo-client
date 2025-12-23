/**
 * @internal
 * Used to set `extensions` on the GraphQL result without exposing it
 * unnecessarily. Only use internally!
 */
export const extensionsSymbol = Symbol.for("apollo.result.extensions");

/**
 * @internal
 * Used to provide details about `@stream` fields to cache merge functions. Only
 * use internally!
 */
export const streamDetailsSymbol = Symbol.for("apollo.result.streamDetails");

/**
 * @internal
 * Used as key for `ApolloClient.WatchQueryOptions`.
 *
 * Meant for framework integrators only!
 */
export const variablesUnknownSymbol = Symbol.for(
  "apollo.observableQuery.variablesUnknown"
);
