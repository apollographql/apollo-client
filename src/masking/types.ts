import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

export interface DataMasking {}

export type Masked<TData> = TData & {
  __masked?: true;
};

export type MaskedDocumentNode<
  TData = { [key: string]: any },
  TVariables = { [key: string]: any },
> = TypedDocumentNode<Masked<TData>, TVariables>;

export type FragmentType<TDocumentType extends TypedDocumentNode<any, any>> =
  TDocumentType extends TypedDocumentNode<infer TType, any> ?
    [TType] extends [{ " $fragmentName"?: infer TKey }] ?
      TKey extends string ?
        { " $fragmentRefs"?: { [key in TKey]: TType } }
      : never
    : never
  : never;
