import type { TypeOverrides } from "@apollo/client";
import type { ApplyHKTImplementationWithDefault } from "@apollo/client/utilities/internal";

import type { GraphQLCodegenDataMasking } from "./GraphQLCodegenDataMasking.js";

type DefaultImplementation = GraphQLCodegenDataMasking.Implementation;

export interface DataMasking {}

export type FragmentType<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "FragmentType",
  DefaultImplementation,
  TData
>;

/**
 * Returns a boolean indicating whether the type is masked or unmasked
 */
export type IsMasked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "IsMasked",
  DefaultImplementation,
  TData
>;

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type Mask<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Mask",
  DefaultImplementation,
  TData
>;

/**
 * Unmasks a type to provide its full result.
 */
export type Unmask<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Unmask",
  DefaultImplementation,
  TData
>;

export type MaybeMasked<TData> =
  true extends IsMasked<TData> ? Mask<TData> : Unmask<TData>;
