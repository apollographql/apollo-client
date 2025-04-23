import type {
  ExecuteContext,
  GraphQLRequest,
  Operation,
} from "@apollo/client/link/core";

export function createOperation(
  starting: any,
  operation: GraphQLRequest,
  { client }: ExecuteContext
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

  return operation as Operation;
}
