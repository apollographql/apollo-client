import type { Tester } from "@jest/expect-utils";

import { CombinedProtocolErrors } from "@apollo/client";

export const areCombinedProtocolErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isACombinedProtocolErrors = CombinedProtocolErrors.is(a);
  const isBCombinedProtocolErrors = CombinedProtocolErrors.is(b);

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
