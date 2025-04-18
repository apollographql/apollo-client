import type {
  ApolloContext,
  DefaultContext,
  OperationContext,
} from "@apollo/client";
import type { GraphQLRequest, Operation } from "@apollo/client/link/core";

export function createOperation(
  starting: any,
  operation: GraphQLRequest,
  apolloContext: ApolloContext
): Operation {
  let context = { ...starting };
  const setContext: Operation["setContext"] = (next) => {
    if (typeof next === "function") {
      context = { ...context, ...next(context) };
    } else {
      context = { ...context, ...next };
    }
  };
  const getContext: Operation["getContext"] = () => ({ ...context });
  const getApolloContext: Operation["getApolloContext"] = () => apolloContext;

  Object.defineProperty(operation, "setContext", {
    enumerable: false,
    value: setContext,
  });

  Object.defineProperty(operation, "getContext", {
    enumerable: false,
    value: getContext,
  });

  Object.defineProperty(operation, "getApolloContext", {
    enumerable: false,
    value: getApolloContext,
  });

  return operation as Operation;
}
