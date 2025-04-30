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
 */
export function isMutationOperation(document: DocumentNode) {
  return isOperation(document, "mutation");
}

/**
 * Determines if a document is a query document.
 */
export function isQueryOperation(document: DocumentNode) {
  return isOperation(document, "query");
}

/**
 * Determines if a document is a subscription document.
 */
export function isSubscriptionOperation(document: DocumentNode) {
  return isOperation(document, "subscription");
}
