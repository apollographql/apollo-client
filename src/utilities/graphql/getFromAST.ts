import type {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from "graphql";

import { checkDocument } from "@apollo/client/utilities/internal";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

type OperationDefinitionWithName = OperationDefinitionNode & {
  name: NonNullable<OperationDefinitionNode["name"]>;
};

export function getOperationDefinition(
  doc: DocumentNode
): OperationDefinitionNode | undefined {
  checkDocument(doc);
  return doc.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === "OperationDefinition"
  )[0];
}

export function getOperationName(doc: DocumentNode): string | null {
  return (
    doc.definitions
      .filter(
        (definition): definition is OperationDefinitionWithName =>
          definition.kind === "OperationDefinition" && !!definition.name
      )
      .map((x) => x.name.value)[0] || null
  );
}

// Returns the FragmentDefinitions from a particular document as an array
export function getFragmentDefinitions(
  doc: DocumentNode
): FragmentDefinitionNode[] {
  return doc.definitions.filter(
    (definition): definition is FragmentDefinitionNode =>
      definition.kind === "FragmentDefinition"
  );
}

export function getQueryDefinition(doc: DocumentNode): OperationDefinitionNode {
  const queryDef = getOperationDefinition(doc)!;

  invariant(
    queryDef && queryDef.operation === "query",
    "Must contain a query definition."
  );

  return queryDef;
}

export function getFragmentDefinition(
  doc: DocumentNode
): FragmentDefinitionNode {
  invariant(
    doc.kind === "Document",
    `Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`
  );

  invariant(
    doc.definitions.length <= 1,
    "Fragment must have exactly one definition."
  );

  const fragmentDef = doc.definitions[0] as FragmentDefinitionNode;

  invariant(
    fragmentDef.kind === "FragmentDefinition",
    "Must be a fragment definition."
  );

  return fragmentDef as FragmentDefinitionNode;
}

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
      const operation = (definition as OperationDefinitionNode).operation;
      if (
        operation === "query" ||
        operation === "mutation" ||
        operation === "subscription"
      ) {
        return definition as OperationDefinitionNode;
      }
    }
    if (definition.kind === "FragmentDefinition" && !fragmentDefinition) {
      // we do this because we want to allow multiple fragment definitions
      // to precede an operation definition.
      fragmentDefinition = definition as FragmentDefinitionNode;
    }
  }

  if (fragmentDefinition) {
    return fragmentDefinition;
  }

  throw newInvariantError(
    "Expected a parsed GraphQL query with a query, mutation, subscription, or a fragment."
  );
}
