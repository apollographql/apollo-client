import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

export interface DataMasking {}

export type Masked<TData> = TData & {
  __masked?: true;
};

export type MaskedDocumentNode<
  TData = { [key: string]: any },
  TVariables = { [key: string]: any },
> = TypedDocumentNode<Masked<TData>, TVariables>;
