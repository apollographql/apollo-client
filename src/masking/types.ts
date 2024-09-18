import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

export interface DataMasking {}

export type Masked<TData> = TData & {
  __masked?: true;
};

/** @internal */
export type MaybeMasked<TData> =
  TData extends { __masked?: true } ? RemoveMaskedMarkers<TData>
  : DataMasking extends { enabled: true } ? RemoveMaskedMarkers<TData>
  : Unmask<TData>;

export type MaskedDocumentNode<
  TData = { [key: string]: any },
  TVariables = { [key: string]: any },
> = TypedDocumentNode<Masked<TData>, TVariables>;

/** @internal */
export type Unmask<TData> =
  TData extends { " $unmasked": infer TUnmaskedData } ? TUnmaskedData : TData;

type RemoveMaskedMarkers<TData> = Omit<TData, "__masked" | " $unmasked"> & {};
