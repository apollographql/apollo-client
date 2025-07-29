import type { GraphQLRequest } from "@apollo/client/link";
import { newInvariantError } from "@apollo/client/utilities/invariant";

export function validateRequest(request: GraphQLRequest): void {
  const OPERATION_FIELDS = [
    "query",
    "operationName",
    "operationType",
    "variables",
    "extensions",
    "context",
  ];
  for (let key of Object.keys(request)) {
    if (OPERATION_FIELDS.indexOf(key) < 0) {
      throw newInvariantError(`illegal argument: %s`, key);
    }
  }
}
