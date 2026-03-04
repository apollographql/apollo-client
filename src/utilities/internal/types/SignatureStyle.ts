import type { ApolloClient, TypeOverrides } from "@apollo/client";

/**
 * Signature style used for `ApolloClient` methods and hooks.
 * Classic signatures are method signatures in place until 4.1
 * Modern signatures are the method signatures introduced in 4.1,
 * which are more accurate and take global `defaultOptions` into account.
 * Modern signatures need to be inferred and cannot have manually specified
 * generics, so we want users to opt into them, either by explicitly declaring
 * their signature style or by using `defaultOptions`.
 */
export type SignatureStyle =
  TypeOverrides extends (
    {
      // explicit userland declaration of signature style
      signatureStyle: infer S extends "modern" | "classic";
    }
  ) ?
    S
  : // if any non-optional `DeclareDefaultOptions` are present,
  // we assume the user is using the "modern" signature style
  ApolloClient.Options extends { defaultOptions: {} } ? "modern"
  : "classic";

/**
 * A type to disable "classic" signatures when "modern" signatures are in use.
 * Modern signatures are always active, as they are more complete than classic
 * signatures, but they are defined after the classic signatures, so while
 * classic signatures are active, TypeScript will not reach the modern signatures
 * as long as a classic signature can be satisfied.
 */
export type ClassicSignature =
  SignatureStyle extends "classic" ? unknown : never;
