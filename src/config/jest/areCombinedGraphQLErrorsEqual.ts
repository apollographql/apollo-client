import type { Tester } from "@jest/expect-utils";

import { CombinedGraphQLErrors } from "@apollo/client";

export const areCombinedGraphQLErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isACombinedGraphQLErrors = CombinedGraphQLErrors.is(a);
  const isBCombinedGraphQLErrors = CombinedGraphQLErrors.is(b);

  if (isACombinedGraphQLErrors && isBCombinedGraphQLErrors) {
    return (
      a.message === b.message &&
      this.equals(a.errors, b.errors, customTesters) &&
      this.equals(a.data, b.data, customTesters) &&
      this.equals(a.extensions, b.extensions, customTesters)
    );
  } else if (isACombinedGraphQLErrors === isBCombinedGraphQLErrors) {
    return undefined;
  } else {
    return false;
  }
};
