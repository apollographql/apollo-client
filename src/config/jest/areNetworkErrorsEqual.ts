import type { Tester } from "@jest/expect-utils";

import { NetworkError } from "@apollo/client/errors";

export const areNetworkErrorsEqual: Tester = function (a, b, customTesters) {
  const isANetworkError = NetworkError.is(a);
  const isBNetworkError = NetworkError.is(b);

  if (isANetworkError && isBNetworkError) {
    return (
      a.message === b.message && this.equals(a.cause, b.cause, customTesters)
    );
  } else if (isANetworkError === isBNetworkError) {
    return undefined;
  } else {
    return false;
  }
};
