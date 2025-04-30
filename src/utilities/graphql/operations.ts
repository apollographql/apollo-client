import type { DocumentNode } from "@apollo/client";
import { getOperationDefinition } from "@apollo/client/utilities/internal";

function isOperation(
  document: DocumentNode,
  operation: "query" | "mutation" | "subscription"
) {
  return getOperationDefinition(document)?.operation === operation;
}

/**
 * Determines if a document is a mutation document.
 *
 * @since 3.8.0
 */
export function isMutationOperation(document: DocumentNode) {
  return isOperation(document, "mutation");
}

/**
 * Determines if a document is a query document.
 *
 * @since 3.8.0
 */
export function isQueryOperation(document: DocumentNode) {
  return isOperation(document, "query");
}

/**
 * Determines if a document is a subscription document.
 *
 * @since 3.8.0
 */
export function isSubscriptionOperation(document: DocumentNode) {
  return isOperation(document, "subscription");
}
