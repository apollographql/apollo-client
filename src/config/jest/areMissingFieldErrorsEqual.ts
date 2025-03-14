import type { Tester } from "@jest/expect-utils";

import { MissingFieldError } from "@apollo/client/cache";

export const areMissingFieldErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isAMissingFieldError = a instanceof MissingFieldError;
  const isBMissingFieldError = b instanceof MissingFieldError;

  if (isAMissingFieldError && isBMissingFieldError) {
    return (
      a.message === b.message &&
      this.equals(a.path, b.path, customTesters) &&
      this.equals(a.query, b.query, customTesters) &&
      this.equals(a.variables, b.variables, customTesters) &&
      this.equals(a.missing, b.missing, customTesters)
    );
  }

  if (isAMissingFieldError === isBMissingFieldError) {
    return;
  }

  return false;
};
