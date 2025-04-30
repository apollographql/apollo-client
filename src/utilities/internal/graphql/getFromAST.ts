import type {
  DocumentNode,
  OperationDefinitionNode,
  OperationTypeNode,
  ValueNode,
} from "graphql";

import { valueToObjectRepresentation } from "@apollo/client/utilities";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

// Checks the document for errors and throws an exception if there is an error.
/** @internal */
export function checkDocument(
  doc: DocumentNode,
  expectedType?: OperationTypeNode
) {
  invariant(
    doc && doc.kind === "Document",
    `Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`
  );

  const operations = doc.definitions
    .filter((d) => d.kind !== "FragmentDefinition")
    .map((definition) => {
      if (definition.kind !== "OperationDefinition") {
        throw newInvariantError(
          `Schema type definitions not allowed in queries. Found: "%s"`,
          definition.kind
        );
      }
      return definition;
    });

  invariant(
    operations.length <= 1,
    `Ambiguous GraphQL document: contains %s operations`,
    operations.length
  );

  if (expectedType) {
    invariant(
      operations.length == 1 && operations[0].operation === expectedType,
      `Running a %s requires a graphql ` + `%s, but a %s was used instead.`,
      expectedType,
      expectedType,
      operations[0].operation
    );
  }

  return doc;
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
