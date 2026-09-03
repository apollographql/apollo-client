import type { ApolloCache } from "@apollo/client";

type UnwrapScalarType<TScalarName extends string> =
  TScalarName extends `[${infer TName extends string}]` ?
    UnwrapScalarType<TName>
  : TScalarName & keyof ApolloCache.Scalars;

/** @internal */
export function unwrapScalarType<TScalarName extends string>(
  scalarType: TScalarName
): UnwrapScalarType<TScalarName> {
  return scalarType.replace(/[[\]]/g, "") as UnwrapScalarType<TScalarName>;
}
