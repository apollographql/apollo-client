import type { DocumentNode } from "graphql";

import { __DEV__ } from "@apollo/client/utilities/environment";
import { hasDirectives } from "@apollo/client/utilities/internal";

export function hasClientExports(document: DocumentNode) {
  return document && hasDirectives(["client", "export"], document, true);
}
