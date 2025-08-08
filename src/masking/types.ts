import type { TypeOverrides } from "@apollo/client";
import type { ApplyHKTImplementationWithDefault } from "@apollo/client/utilities/internal";

import type { PreserveTypes } from "./PreserveTypes.js";

export interface DataMasking {}

export type FragmentType<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "FragmentType",
  PreserveTypes.Implementation,
  TData
>;

/** Unwraps `TData` into its unmasked type */
export type Unmasked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Unmask",
  PreserveTypes.Implementation,
  TData
>;

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type MaybeMasked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Mask",
  PreserveTypes.Implementation,
  TData
>;
