import type { LocalResolversLink } from "@apollo/client/link/local-resolvers";

// Note: These types are not defined in a namespace because GraphQL Codegen
// does not handle namespaces correctly for some options. Instead of guessing
// which work and which don't, we provide all types used in the config helper as
// separate types.

export type LocalResolversLinkResolverFn<
  TResult,
  TParent = unknown,
  _TContext = never,
  TArgs = Record<string, never>,
> = LocalResolversLink.Resolver<TResult, TParent, TArgs>;

export type LocalResolversLinkResolveInfo = LocalResolversLink.ResolveInfo;
export type LocalResolversLinkContextType = LocalResolversLink.ResolverContext;
