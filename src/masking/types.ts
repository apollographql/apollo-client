import type { TypeOverrides } from "@apollo/client";
import type { ApplyHKTImplementationWithDefault } from "@apollo/client/utilities/internal";

import type { PreserveTypes } from "./PreserveTypes.js";

/**
 * Type used with [fragments](https://apollographql.com/docs/react/data/fragments#using-with-fragments) to ensure parent objects contain the fragment spread from the type.
 */
export type FragmentType<TFragmentData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "FragmentType",
  PreserveTypes.TypeOverrides,
  TFragmentData
>;

/** Unwraps `TData` into its unmasked type. */
export type Unmasked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Unmasked",
  PreserveTypes.TypeOverrides,
  TData
>;

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type MaybeMasked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "MaybeMasked",
  PreserveTypes.TypeOverrides,
  TData
>;
