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
 * @remarks
 * If you are authoring an Apollo link, you might not need this utility.
 * Prefer using the `operationType` property the `operation` object instead.
 *
 * @param document - The GraphQL document to check
 * @returns A boolean indicating if the document is a mutation operation
 *
 * @example
 *
 * ```ts
 * import { isMutationOperation } from "@apollo/client/utilities";
 *
 * const mutation = gql`
 *   mutation MyMutation {
 *     # ...
 *   }
 * `;
 *
 * isMutationOperation(mutation); // true
 * ```
 */
export function isMutationOperation(document: DocumentNode) {
  return isOperation(document, "mutation");
}

/**
 * Determine if a document is a query document.
 *
 * @remarks
 * If you are authoring an Apollo link, you might not need this utility.
 * Prefer using the `operationType` property the `operation` object instead.
 *
 * @param document - The GraphQL document to check
 * @returns A boolean indicating if the document is a query operation
 *
 * @example
 *
 * ```ts
 * import { isQueryOperation } from "@apollo/client/utilities";
 *
 * const query = gql`
 *   query MyQuery {
 *     # ...
 *   }
 * `;
 *
 * isQueryOperation(query); // true
 * ```
 */
export function isQueryOperation(document: DocumentNode) {
  return isOperation(document, "query");
}

/**
 * Determine if a document is a subscription document.
 *
 * @remarks
 * If you are authoring an Apollo link, you might not need this utility.
 * Prefer using the `operationType` property the `operation` object instead.
 *
 * @param document - The GraphQL document to check
 * @returns A boolean indicating if the document is a subscription operation
 *
 * @example
 *
 * ```ts
 * import { isSubscriptionOperation } from "@apollo/client/utilities";
 *
 * const subscription = gql`
 *   subscription MySubscription {
 *     # ...
 *   }
 * `;
 *
 * isSubscriptionOperation(subscription); // true
 * ```
 */
export function isSubscriptionOperation(document: DocumentNode) {
  return isOperation(document, "subscription");
}
