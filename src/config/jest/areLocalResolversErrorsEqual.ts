import type { Tester } from "@jest/expect-utils";

import { LocalResolversError } from "@apollo/client/errors";

export const areLocalResolversErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isALocalResolversError = LocalResolversError.is(a);
  const isBLocalResolversError = LocalResolversError.is(b);

  if (isALocalResolversError && isBLocalResolversError) {
    return (
      a.message === b.message &&
      this.equals(a.path, b.path, customTesters) &&
      this.equals(a.cause, b.cause, customTesters)
    );
  } else if (isALocalResolversError === isBLocalResolversError) {
    return undefined;
  } else {
    return false;
  }
};
