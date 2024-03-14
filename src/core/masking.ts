import type { DocumentNode, TypedDocumentNode } from "./index.js";

export function mask(
  data: any,
  document: TypedDocumentNode<any> | DocumentNode
) {
  return { data };
}
