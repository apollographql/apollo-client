import { Operation } from "../../core/types";

import { buildRetryFunction } from "../retryFunction";

describe("buildRetryFunction", () => {
  const operation = { operationName: "foo" } as Operation;

  it("stops after hitting maxTries", () => {
    const retryFunction = buildRetryFunction({ max: 3 });

    expect(retryFunction(2, operation, {})).toEqual(true);
    expect(retryFunction(3, operation, {})).toEqual(false);
    expect(retryFunction(4, operation, {})).toEqual(false);
  });

  it("skips retries if there was no error, by default", () => {
    const retryFunction = buildRetryFunction();

    expect(retryFunction(1, operation, undefined)).toEqual(false);
    expect(retryFunction(1, operation, {})).toEqual(true);
  });

  it("supports custom predicates, but only if max is not exceeded", () => {
    const stub = jest.fn(() => true);
    const retryFunction = buildRetryFunction({ max: 3, retryIf: stub });

    expect(retryFunction(2, operation, null)).toEqual(true);
    expect(retryFunction(3, operation, null)).toEqual(false);
  });

  it("passes the error and operation through to custom predicates", () => {
    const stub = jest.fn(() => true);
    const retryFunction = buildRetryFunction({ max: 3, retryIf: stub });

    const error = { message: "bewm" };
    retryFunction(1, operation, error);
    expect(stub).toHaveBeenCalledWith(error, operation);
  });
});
