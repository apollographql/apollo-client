// Checks the document for errors and throws an exception if there is an error.

import type { ASTNode } from "graphql";
import type { DocumentNode, OperationTypeNode } from "graphql";
import { Kind, visit } from "graphql";

import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";
import { cacheSizes } from "../caching/sizes.js";

import { getOperationName } from "./getOperationName.js";
import { memoize } from "./memoize.js";

/**
 * Checks the document for errors and throws an exception if there is an error.
 *
 * @internal
 */
export const checkDocument: (
  doc: DocumentNode,
  expectedType?: OperationTypeNode
) => void = memoize(
  (doc: DocumentNode, expectedType?: OperationTypeNode): void => {
    invariant(
      doc && doc.kind === "Document",
      `Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`
    );
    const operations = doc.definitions.filter(
      (d) => d.kind === "OperationDefinition"
    );
    if (__DEV__) {
      doc.definitions.forEach((definition) => {
        if (
          definition.kind !== "OperationDefinition" &&
          definition.kind !== "FragmentDefinition"
        ) {
          throw newInvariantError(
            `Schema type definitions not allowed in queries. Found: "%s"`,
            definition.kind
          );
        }
      });

      invariant(
        operations.length <= 1,
        `Ambiguous GraphQL document: contains %s operations`,
        operations.length
      );
    }

    if (expectedType) {
      invariant(
        operations.length == 1 && operations[0].operation === expectedType,
        `Running a %s requires a graphql ` + `%s, but a %s was used instead.`,
        expectedType,
        expectedType,
        operations[0].operation
      );
    }

    visit(doc, {
      Field(field, _, __, path) {
        if (
          field.alias &&
          (field.alias.value === "__typename" ||
            field.alias.value.startsWith("__ac_")) &&
          field.alias.value !== field.name.value
        ) {
          // not using `invariant` so path calculation only happens in error case
          let current: ASTNode = doc,
            fieldPath: string[] = [];
          for (const key of path) {
            current = (current as any)[key];
            if (current.kind === Kind.FIELD) {
              fieldPath.push(current.alias?.value || current.name.value);
            }
          }
          fieldPath.splice(-1, 1, field.name.value);

          throw newInvariantError(
            '`%s` is a forbidden field alias name in the selection set for field `%s` in %s "%s".',
            field.alias.value,
            fieldPath.join("."),
            operations[0].operation,
            getOperationName(doc, "(anonymous)")
          );
        }
      },
    });
  },
  {
    max: cacheSizes["checkDocument"] || defaultCacheSizes["checkDocument"],
  }
);
