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
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type MaybeMasked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "MaybeMasked",
  DefaultImplementation,
  TData
>;

/**
 * Unmasks a type to provide its full result.
 */
export type Unmask<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Unmasked",
  DefaultImplementation,
  TData
>;
