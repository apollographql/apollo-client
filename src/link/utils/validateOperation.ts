import { newInvariantError } from "@apollo/client/utilities/invariant";
import type { GraphQLRequest } from "@apollo/client/link/core";

export function validateOperation(operation: GraphQLRequest): GraphQLRequest {
  const OPERATION_FIELDS = [
    "query",
    "operationName",
    "variables",
    "extensions",
    "context",
  ];
  for (let key of Object.keys(operation)) {
    if (OPERATION_FIELDS.indexOf(key) < 0) {
      throw newInvariantError(`illegal argument: %s`, key);
    }
  }

  return operation;
}
