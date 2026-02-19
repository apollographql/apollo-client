/**
 * This circular type (that never actually gets evaluated) is needed to prevent
 * TypeScript from eagerly inlining the `ApolloClient.QueryResultForOptions`
 * type, which would cause problems with global types getting evaluated
 * on build of userland wrapping libraries, and not in the final userland project.
 */
export type LazyType<T> = T & { [K in "" as never]: LazyType<never> };
