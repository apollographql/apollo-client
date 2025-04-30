import type { DirectiveNode, DocumentNode } from "graphql";

import { checkDocument } from "./checkDocument.js";
import { removeDirectivesFromDocument } from "./removeDirectivesFromDocument.js";

/**
 * Remove fields / selection sets that include an @client directive.
 *
 * @internal
 */
export function removeClientSetsFromDocument(
  document: DocumentNode
): DocumentNode | null {
  checkDocument(document);

  let modifiedDoc = removeDirectivesFromDocument(
    [
      {
        test: (directive: DirectiveNode) => directive.name.value === "client",
        remove: true,
      },
    ],
    document
  );

  return modifiedDoc;
}
