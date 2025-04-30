import type { DocumentNode, OperationDefinitionNode } from "graphql";

import { checkDocument } from "./checkDocument.js";

/** @internal */
export function getOperationDefinition(
  doc: DocumentNode
): OperationDefinitionNode | undefined {
  checkDocument(doc);
  return doc.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === "OperationDefinition"
  )[0];
}
