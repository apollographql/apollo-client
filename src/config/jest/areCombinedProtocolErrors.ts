import type { Tester } from "@jest/expect-utils";

import { CombinedProtocolErrors } from "@apollo/client/errors";

export const areCombinedProtocolErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isACombinedGraphQLErrors = a instanceof CombinedProtocolErrors;
  const isBCombinedGraphQLErrors = b instanceof CombinedProtocolErrors;

  if (isACombinedGraphQLErrors && isBCombinedGraphQLErrors) {
    return (
      a.message === b.message && this.equals(a.errors, b.errors, customTesters)
    );
  } else if (isACombinedGraphQLErrors === isBCombinedGraphQLErrors) {
    return undefined;
  } else {
    return false;
  }
};
