import type { ApolloLink } from "@apollo/client/link";

// not exported
// eslint-disable-next-line local-rules/no-relative-imports
import { buildRetryFunction } from "../retryFunction.js";

describe("buildRetryFunction", () => {
  const operation = { operationName: "foo" } as ApolloLink.Operation;

  it("stops after hitting maxTries", () => {
    const error = new Error();
    const retryFunction = buildRetryFunction({ max: 3 });

    expect(retryFunction(2, operation, error)).toEqual(true);
    expect(retryFunction(3, operation, error)).toEqual(false);
    expect(retryFunction(4, operation, error)).toEqual(false);
  });

  it("supports custom predicates, but only if max is not exceeded", () => {
    const error = new Error();
    const stub = jest.fn(() => true);
    const retryFunction = buildRetryFunction({ max: 3, retryIf: stub });

    expect(retryFunction(2, operation, error)).toEqual(true);
    expect(retryFunction(3, operation, error)).toEqual(false);
  });

  it("passes the error and operation through to custom predicates", () => {
    const stub = jest.fn(() => true);
    const retryFunction = buildRetryFunction({ max: 3, retryIf: stub });

    const error = new Error("bewm");
    void retryFunction(1, operation, error);
    expect(stub).toHaveBeenCalledWith(error, operation);
  });
});
