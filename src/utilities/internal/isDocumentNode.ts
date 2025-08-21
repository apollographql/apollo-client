import type { DocumentNode } from "graphql";

import { isNonNullObject } from "./isNonNullObject.js";

/** @internal */
export function isDocumentNode(value: unknown): value is DocumentNode {
  return (
    isNonNullObject(value) &&
    (value as DocumentNode).kind === "Document" &&
    Array.isArray((value as DocumentNode).definitions)
  );
}
