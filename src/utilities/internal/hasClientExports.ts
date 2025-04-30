import type { DocumentNode } from "graphql";

import { hasDirectives } from "./hasDirectives.js";

export function hasClientExports(document: DocumentNode) {
  return document && hasDirectives(["client", "export"], document, true);
}
