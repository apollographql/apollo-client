import type { DocumentNode } from "graphql";

import { isNonNullObject } from "@apollo/client/utilities";

/** @internal */
export function isDocumentNode(value: unknown): value is DocumentNode {
  return (
    isNonNullObject(value) &&
    (value as DocumentNode).kind === "Document" &&
    Array.isArray((value as DocumentNode).definitions)
  );
}
