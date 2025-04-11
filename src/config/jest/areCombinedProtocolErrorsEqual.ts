import type { Tester } from "@jest/expect-utils";

export const areCombinedProtocolErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isACombinedProtocolErrors = a && a.name === "CombinedProtocolErrors";
  const isBCombinedProtocolErrors = b && b.name === "CombinedProtocolErrors";

  if (isACombinedProtocolErrors && isBCombinedProtocolErrors) {
    return (
      a.message === b.message && this.equals(a.errors, b.errors, customTesters)
    );
  } else if (isACombinedProtocolErrors === isBCombinedProtocolErrors) {
    return undefined;
  } else {
    return false;
  }
};
