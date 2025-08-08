import type { TypeOverrides } from "@apollo/client";
import type { ApplyHKTImplementationWithDefault } from "@apollo/client/utilities/internal";

import type { PreserveTypes } from "./PreserveTypes.js";

export interface DataMasking {}

export type FragmentType<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "FragmentType",
  PreserveTypes.TypeOverrides,
  TData
>;

/** Unwraps `TData` into its unmasked type */
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
