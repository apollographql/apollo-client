import type { TypeOverrides } from "@apollo/client";
import type { ApplyHKTImplementationWithDefault } from "@apollo/client/utilities/internal";

import type { GraphQLCodegenDataMasking } from "./GraphQLCodegenDataMasking.js";

type DefaultImplementation = GraphQLCodegenDataMasking.Implementation;

export interface DataMasking {}

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type Masked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
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
  TypeOverrides,
  "MaskedDocumentNode",
  DefaultImplementation,
  TData,
  TVariables
>;

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
export type Unmasked<TData> = ApplyHKTImplementationWithDefault<
  TypeOverrides,
  "Unmasked",
  DefaultImplementation,
  TData
>;
