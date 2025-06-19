import type {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from "graphql";

import { checkDocument } from "@apollo/client/utilities/internal";
import { newInvariantError } from "@apollo/client/utilities/invariant";

/**
 * Returns the first operation definition found in this document.
 * If no operation definition is found, the first fragment definition will be returned.
 * If no definitions are found, an error will be thrown.
 */
export function getMainDefinition(
  queryDoc: DocumentNode
): OperationDefinitionNode | FragmentDefinitionNode {
  checkDocument(queryDoc);

  let fragmentDefinition;

  for (let definition of queryDoc.definitions) {
    if (definition.kind === "OperationDefinition") {
      return definition;
    }

    if (definition.kind === "FragmentDefinition" && !fragmentDefinition) {
      // we do this because we want to allow multiple fragment definitions
      // to precede an operation definition.
      fragmentDefinition = definition;
    }
  }

  if (fragmentDefinition) {
    return fragmentDefinition;
  }

  throw newInvariantError(
    "Expected a parsed GraphQL query with a query, mutation, subscription, or a fragment."
  );
}
