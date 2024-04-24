import type { GraphQLRequest, Operation } from "../core/index.js";

export function createOperation(
  starting: any,
  operation: GraphQLRequest
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

  return operation as Operation;
}
