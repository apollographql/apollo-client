import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

import type { Prettify } from "@apollo/client/utilities";

import type {
  ContainsFragmentsRefs,
  IsAny,
  RemoveFragmentName,
  RemoveMaskedMarker,
  UnwrapFragmentRefs,
} from "./internal/types.js";


export interface DataMasking {}

/**
 * Marks a type as masked. This is used by `MaybeMasked` when determining
 * whether to use the masked or unmasked type.
 */
export type Masked<TData> = TData & {
  __masked?: true;
};

/**
 * Marks a type as masked. This is a shortcut for
 * `TypedDocumentNode<Masked<TData>, TVariables>`
 */
export type MaskedDocumentNode<
  TData = { [key: string]: any },
  TVariables = { [key: string]: any },
> = TypedDocumentNode<Masked<TData>, TVariables>;

export type FragmentType<TData> =
  [TData] extends [{ " $fragmentName"?: infer TKey }] ?
    TKey extends string ?
      { " $fragmentRefs"?: { [key in TKey]: TData } }
    : never
  : never;

/**
 * Returns TData as either masked or unmasked depending on whether masking is
 * enabled.
 */
export type MaybeMasked<TData> =
  DataMasking extends { mode: "unmask" } ?
    // distribute TData - in case of a union, do the next steps for each member
    TData extends any ?
      // prevent "Type instantiation is excessively deep and possibly infinite."
      true extends IsAny<TData> ? TData
      : TData extends { __masked?: true } ? Prettify<RemoveMaskedMarker<TData>>
      : Unmasked<TData>
    : never
  : DataMasking extends { mode: "preserveTypes" } ? TData
  : TData;

/**
 * Unmasks a type to provide its full result.
 */
export type Unmasked<TData> =
  true extends IsAny<TData> ? TData
  : TData extends object ?
    true extends ContainsFragmentsRefs<TData> ?
      UnwrapFragmentRefs<RemoveMaskedMarker<RemoveFragmentName<TData>>>
    : TData
  : TData;
