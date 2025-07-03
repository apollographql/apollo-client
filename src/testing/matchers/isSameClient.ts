import type { Tester } from "@jest/expect-utils";

import { ApolloClient } from "@apollo/client";

export const isSameClient: Tester = function (a, b) {
  const isAClient = a instanceof ApolloClient;
  const isBClient = b instanceof ApolloClient;

  if (isAClient && isBClient) {
    return a === b;
  } else if (isAClient === isBClient) {
    return undefined;
  } else {
    return false;
  }
};
