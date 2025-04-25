import type { LocalResolversLink } from "@apollo/client/link/local-resolvers";

// Note: GraphQL Codegen does not handle namespaces properly for the
// `customResolverFn` option, so this type needs to exist outside of a
// namespace.
export type LocalResolversLinkResolverFn<
  TResult,
  TParent = unknown,
  _TContext = never,
  TArgs = Record<string, never>,
> = LocalResolversLink.Resolver<TResult, TParent, TArgs>;
