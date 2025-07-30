import type {
  ExecuteContext,
  GraphQLRequest,
  Operation,
} from "@apollo/client/link";
import {
  getOperationDefinition,
  getOperationName,
} from "@apollo/client/utilities/internal";

export function createOperation(
  request: GraphQLRequest,
  { client }: ExecuteContext
): Operation {
  const operation = {
    query: request.query,
    variables: request.variables || {},
    extensions: request.extensions || {},
    operationName: request.operationName || getOperationName(request.query),
    operationType:
      request.operationType || getOperationDefinition(request.query)!.operation,
  } satisfies Omit<
    Operation,
    "client" | "getContext" | "setContext"
  > as Operation;

  let context = { ...request.context };

  const setContext: Operation["setContext"] = (next) => {
    if (typeof next === "function") {
      context = { ...context, ...next({ ...context }) };
    } else {
      context = { ...context, ...next };
    }
  };
  const getContext: Operation["getContext"] = () => ({ ...context });

  Object.defineProperty(operation, "setContext", {
    enumerable: false,
    value: setContext,
  });

  Object.defineProperty(operation, "getContext", {
    enumerable: false,
    value: getContext,
  });

  Object.defineProperty(operation, "client", {
    enumerable: false,
    value: client,
  });

  return operation;
}
