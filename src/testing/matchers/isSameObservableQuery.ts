import type { Tester } from "@jest/expect-utils";

import { ObservableQuery } from "@apollo/client";

export const isSameObservableQuery: Tester = function (a, b) {
  const isAObservableQuery = a instanceof ObservableQuery;
  const isBObservableQuery = b instanceof ObservableQuery;

  if (isAObservableQuery && isBObservableQuery) {
    return a === b;
  } else if (isAObservableQuery === isBObservableQuery) {
    return undefined;
  } else {
    return false;
  }
};
