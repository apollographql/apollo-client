import type { GraphQLRequest } from "@apollo/client/link";
import {
  getOperationDefinition,
  getOperationName,
} from "@apollo/client/utilities/internal";

export function transformOperation(operation: GraphQLRequest): GraphQLRequest {
  const transformedOperation: GraphQLRequest = {
    variables: operation.variables || {},
    extensions: operation.extensions || {},
    operationName: operation.operationName,
    operationType: operation.operationType,
    query: operation.query,
  };

  // The following conditions are here to handle cases where `execute` might be
  // called with a `GraphQLRequest` that doesn't set these properties, for
  // example in tests. Apollo Client core will provide these, but these checks
  // are useful to avoid end-users from having to pass these in when calling
  // `execute`.

  if (!transformedOperation.operationName) {
    transformedOperation.operationName = getOperationName(
      transformedOperation.query
    );
  }

  if (!transformedOperation.operationType) {
    transformedOperation.operationType = getOperationDefinition(
      transformedOperation.query
    )!.operation;
  }

  return transformedOperation;
}
