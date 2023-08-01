import type { DocumentNode } from "../../core/index.js";
import { getOperationDefinition } from "./getFromAST.js";

function isOperation(
  document: DocumentNode,
  operation: "query" | "mutation" | "subscription"
) {
  return getOperationDefinition(document)?.operation === operation;
}

export function isMutationOperation(document: DocumentNode) {
  return isOperation(document, "mutation");
}

export function isQueryOperation(document: DocumentNode) {
  return isOperation(document, "query");
}

export function isSubscriptionOperation(document: DocumentNode) {
  return isOperation(document, "subscription");
}
