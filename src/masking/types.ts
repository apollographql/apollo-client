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

/** Unwraps the type into its masked type */
export type Mask<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Mask",
  PreserveTypes.Implementation,
  TData
>;

/** Unwraps the type into its unmasked type */
export type Unmask<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Unmask",
  PreserveTypes.Implementation,
  TData
>;

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type MaybeMasked<TData> = Mask<TData>;
