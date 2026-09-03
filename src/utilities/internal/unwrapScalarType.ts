import type { ApolloCache } from "@apollo/client";
import type { ScalarType } from "@apollo/client/cache";

type UnwrapScalarType<TScalarName extends ScalarType> =
  TScalarName extends `[${infer TName extends string}]` ?
    UnwrapScalarType<TName>
  : TScalarName extends keyof ApolloCache.Scalars ? TScalarName
  : never;

/** @internal */
export function unwrapScalarType<TScalarName extends ScalarType>(
  scalarType: TScalarName
): UnwrapScalarType<TScalarName> {
  return scalarType.replace(/[[\]]/g, "") as UnwrapScalarType<TScalarName>;
}
