import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";

import { ApolloClient, ObservableQuery } from "@apollo/client/core";

function isKnownClassInstance(value: unknown) {
  return [ApolloClient, ObservableQuery].some((c) => value instanceof c);
}

export const toEqualStrictTyped: MatcherFunction<[value: any]> = function (
  actual,
  expected
) {
  const value = actual as Record<string, any>;
  const hint = this.utils.matcherHint(
    this.isNot ? ".not.toEqualStrictTyped" : "toEqualStrictTyped",
    "value",
    "expected",
    { isNot: this.isNot, promise: this.promise }
  );

  const serializableProperties = Object.entries(value).reduce(
    (memo, [key, value]) => {
      if (typeof value === "function" || isKnownClassInstance(value)) {
        return memo;
      }

      return { ...memo, [key]: value };
    },
    {} as Record<string, any>
  );

  const pass = this.equals(
    serializableProperties,
    expected,
    // https://github.com/jestjs/jest/blob/22029ba06b69716699254bb9397f2b3bc7b3cf3b/packages/expect/src/matchers.ts#L62-L67
    [...this.customTesters, iterableEquality],
    true
  );

  return {
    pass,
    message: () => {
      if (pass) {
        return hint + `\n\nExpected: not ${this.utils.printExpected(expected)}`;
      }

      return (
        hint +
        "\n\n" +
        this.utils.printDiffOrStringify(
          expected,
          serializableProperties,
          "Expected",
          "Received",
          true
        )
      );
    },
  };
};
