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

/**
 * Returns a boolean indicating whether the type is masked or unmasked
 */
export type IsMasked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "IsMasked",
  PreserveTypes.Implementation,
  TData
>;

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type Mask<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Mask",
  PreserveTypes.Implementation,
  TData
>;

/**
 * Unmasks a type to provide its full result.
 */
export type Unmask<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Unmask",
  PreserveTypes.Implementation,
  TData
>;

export type MaybeMasked<TData> =
  true extends IsMasked<TData> ? Mask<TData> : Unmask<TData>;
