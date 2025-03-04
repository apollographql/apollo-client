import { CombinedGraphQLErrors } from "../../errors/index.js";
import type { Tester } from "@jest/expect-utils";

export const areCombinedGraphQLErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isACombinedGraphQLErrors = a instanceof CombinedGraphQLErrors;
  const isBCombinedGraphQLErrors = b instanceof CombinedGraphQLErrors;

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
