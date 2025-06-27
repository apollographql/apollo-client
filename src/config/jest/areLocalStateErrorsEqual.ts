import type { Tester } from "@jest/expect-utils";

import { LocalStateError } from "@apollo/client/errors";

export const areLocalStateErrorsEqual: Tester = function (a, b, customTesters) {
  const isALocalStateError = LocalStateError.is(a);
  const isBLocalStateError = LocalStateError.is(b);

  if (isALocalStateError && isBLocalStateError) {
    return (
      a.message === b.message &&
      this.equals(a.path, b.path, customTesters) &&
      this.equals(a.cause, b.cause, customTesters)
    );
  } else if (isALocalStateError === isBLocalStateError) {
    return undefined;
  } else {
    return false;
  }
};
