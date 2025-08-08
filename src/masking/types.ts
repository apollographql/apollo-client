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

type IsMaskingEnabled<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "IsMaskingEnabled",
  PreserveTypes.Implementation,
  TData
>;

/** Returns the type as a masked type */
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

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type MaybeMasked<TData> =
  true extends IsMaskingEnabled<TData> ? Mask<TData> : Unmask<TData>;
