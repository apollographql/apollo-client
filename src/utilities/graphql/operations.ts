import type { DocumentNode } from "@apollo/client";
import { getOperationDefinition } from "@apollo/client/utilities/internal";

function isOperation(
  document: DocumentNode,
  operation: "query" | "mutation" | "subscription"
) {
  return getOperationDefinition(document)?.operation === operation;
}

/**
 * Determine if a document is a mutation document.
 *
 * @param document - The GraphQL document to check
 *
 * @since 3.8.0
 */
export function isMutationOperation(document: DocumentNode) {
  return isOperation(document, "mutation");
}

/**
 * Determine if a document is a query document.
 *
 * @param document - The GraphQL document to check
 *
 * @since 3.8.0
 */
export function isQueryOperation(document: DocumentNode) {
  return isOperation(document, "query");
}

/**
 * Determine if a document is a subscription document.
 *
 * @param document - The GraphQL document to check
 *
 * @since 3.8.0
 */
export function isSubscriptionOperation(document: DocumentNode) {
  return isOperation(document, "subscription");
}
