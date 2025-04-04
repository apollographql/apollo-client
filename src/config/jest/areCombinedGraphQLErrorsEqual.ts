import type { Tester } from "@jest/expect-utils";

export const areCombinedGraphQLErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isACombinedGraphQLErrors = a && a.name === "CombinedGraphQLErrors";
  const isBCombinedGraphQLErrors = b && b.name === "CombinedGraphQLErrors";

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
