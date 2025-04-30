import type {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  ValueNode,
} from "graphql";

import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

import { checkDocument } from "../checkDocument.js";
import { getOperationDefinition } from "../getOperationDefinition.js";
import { valueToObjectRepresentation } from "../valueToObjectRepresentation.js";

type OperationDefinitionWithName = OperationDefinitionNode & {
  name: NonNullable<OperationDefinitionNode["name"]>;
};

/** @internal */
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

export function getDefaultValues(
  definition: OperationDefinitionNode | undefined
): Record<string, any> {
  const defaultValues = {};
  const defs = definition && definition.variableDefinitions;
  if (defs && defs.length) {
    defs.forEach((def) => {
      if (def.defaultValue) {
        valueToObjectRepresentation(
          defaultValues,
          def.variable.name,
          def.defaultValue as ValueNode
        );
      }
    });
  }
  return defaultValues;
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
