import type { GraphQLRequest } from "@apollo/client/link";
import { getOperationName } from "@apollo/client/utilities/internal";

export function transformOperation(operation: GraphQLRequest): GraphQLRequest {
  const transformedOperation: GraphQLRequest = {
    variables: operation.variables || {},
    extensions: operation.extensions || {},
    operationName: operation.operationName,
    operationType: operation.operationType,
    query: operation.query,
  };

  // Best guess at an operation name
  if (!transformedOperation.operationName) {
    transformedOperation.operationName =
      typeof transformedOperation.query !== "string" ?
        getOperationName(transformedOperation.query)
      : "";
  }

  return transformedOperation;
}
