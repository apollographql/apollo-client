import type { ApplyHKTImplementationWithDefault } from "@apollo/client/utilities/internal";

import type { GraphQLCodegenDataMasking } from "./GraphQLCodegenDataMasking.js";
type DefaultImplementation = GraphQLCodegenDataMasking.Implementation;

export interface DataMasking {}

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type Masked<TData> = ApplyHKTImplementationWithDefault<
  DataMasking,
  "Masked",
  DefaultImplementation,
  TData
>;

/**
 * Marks a type as masked. This is a shortcut for
 * `TypedDocumentNode<Masked<TData>, TVariables>`
 */
export type MaskedDocumentNode<
  TData = { [key: string]: any },
  TVariables = { [key: string]: any },
> = ApplyHKTImplementationWithDefault<
  DataMasking,
  "MaskedDocumentNode",
  DefaultImplementation,
  TData,
  TVariables
>;

export type FragmentType<TData> = ApplyHKTImplementationWithDefault<
  DataMasking,
  "FragmentType",
  DefaultImplementation,
  TData
>;

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type MaybeMasked<TData> = ApplyHKTImplementationWithDefault<
  DataMasking,
  "MaybeMasked",
  DefaultImplementation,
  TData
>;

/**
 * Unmasks a type to provide its full result.
 */
export type Unmasked<TData> = ApplyHKTImplementationWithDefault<
  DataMasking,
  "Unmasked",
  DefaultImplementation,
  TData
>;
