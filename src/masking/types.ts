import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type {
  RemoveFragmentName,
  RemoveMaskedMarker,
  UnwrapFragmentRefs,
} from "./internal/types.ts";
import type { Prettify } from "../utilities/index.js";

export interface DataMasking {}

export type Masked<TData> = TData & {
  __masked?: true;
};

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

export type MaybeMasked<TData> =
  TData extends { __masked?: true } ? Prettify<RemoveMaskedMarker<TData>>
  : DataMasking extends { enabled: true } ? TData
  : Unmasked<TData>;

export type Unmasked<TData> =
  TData extends object ?
    UnwrapFragmentRefs<RemoveMaskedMarker<RemoveFragmentName<TData>>>
  : TData;
