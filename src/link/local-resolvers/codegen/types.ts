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

// GraphQL Codegen has no way to turn off some features, such as the generated
// __isTypeOf field with a resolver that is incompatible with
// LocalResolversLink. This type wraps Resolvers
export type FixCodegenResolversForLocalResolversLink<TResolvers> = {
  [Typename in keyof TResolvers]: OmitUnsupportedResolvers<
    TResolvers[Typename]
  >;
};

type OmitUnsupportedResolvers<T> =
  T extends Record<string, any> ? Omit<T, "__isTypeOf" | "__resolveType">
  : never;
