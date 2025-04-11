import type { Tester } from "@jest/expect-utils";

export const areServerErrorsEqual: Tester = function (a, b, customTesters) {
  const isAServerError = a && a.name === "ServerError";
  const isBServerError = b && b.name === "ServerError";

  if (isAServerError && isBServerError) {
    return (
      a.message === b.message &&
      this.equals(a.response, b.response, customTesters) &&
      this.equals(a.statusCode, b.statusCode, customTesters) &&
      this.equals(a.result, b.result, customTesters)
    );
  } else if (isAServerError === isBServerError) {
    return undefined;
  } else {
    return false;
  }
};
