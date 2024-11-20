import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type {
  ContainsFragmentsRefs,
  RemoveFragmentName,
  RemoveMaskedMarker,
  UnwrapFragmentRefs,
} from "./internal/types.ts";
import type { Prettify } from "../utilities/index.js";

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
  TData extends { __masked?: true } ? Prettify<RemoveMaskedMarker<TData>>
  : DataMasking extends { enabled: true } ? TData
  : true extends ContainsFragmentsRefs<TData> ? Unmasked<TData>
  : TData;

/**
 * Unmasks a type to provide its full result.
 */
export type Unmasked<TData> =
  TData extends object ?
    UnwrapFragmentRefs<RemoveMaskedMarker<RemoveFragmentName<TData>>>
  : TData;
