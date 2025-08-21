import type { Tester } from "@jest/expect-utils";

import { ServerError } from "@apollo/client";

export const areServerErrorsEqual: Tester = function (a, b, customTesters) {
  const isAServerError = ServerError.is(a);
  const isBServerError = ServerError.is(b);

  if (isAServerError && isBServerError) {
    return (
      a.message === b.message &&
      this.equals(a.response, b.response, customTesters) &&
      this.equals(a.statusCode, b.statusCode, customTesters) &&
      this.equals(a.bodyText, b.bodyText, customTesters)
    );
  } else if (isAServerError === isBServerError) {
    return undefined;
  } else {
    return false;
  }
};
