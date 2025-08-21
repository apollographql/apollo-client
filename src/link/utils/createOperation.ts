import type { ApolloLink } from "@apollo/client/link";
import {
  getOperationDefinition,
  getOperationName,
} from "@apollo/client/utilities/internal";

export function createOperation(
  request: ApolloLink.Request,
  { client }: ApolloLink.ExecuteContext
): ApolloLink.Operation {
  const operation = {
    query: request.query,
    variables: request.variables || {},
    extensions: request.extensions || {},
    operationName: getOperationName(request.query),
    operationType: getOperationDefinition(request.query)!.operation,
  } satisfies Omit<
    ApolloLink.Operation,
    "client" | "getContext" | "setContext"
  > as ApolloLink.Operation;

  let context = { ...request.context };

  const setContext: ApolloLink.Operation["setContext"] = (next) => {
    if (typeof next === "function") {
      context = { ...context, ...next(getContext()) };
    } else {
      context = { ...context, ...next };
    }
  };
  const getContext: ApolloLink.Operation["getContext"] = () =>
    Object.freeze({ ...context });

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
