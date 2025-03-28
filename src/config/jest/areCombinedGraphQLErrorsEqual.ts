import type { Tester } from "@jest/expect-utils";

import { CombinedGraphQLErrors } from "@apollo/client/errors";

export const areCombinedGraphQLErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isACombinedGraphQLErrors = a instanceof CombinedGraphQLErrors;
  const isBCombinedGraphQLErrors = b instanceof CombinedGraphQLErrors;

  if (isACombinedGraphQLErrors && isBCombinedGraphQLErrors) {
    return (
      a.message === b.message &&
      this.equals(a.errors, b.errors, customTesters) &&
      this.equals(a.data, b.data, customTesters)
    );
  } else if (isACombinedGraphQLErrors === isBCombinedGraphQLErrors) {
    return undefined;
  } else {
    return false;
  }
};
