import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";

import { getSerializableProperties } from "./utils/getSerializableProperties.js";

export const toStrictEqualTyped: MatcherFunction<[value: any]> = function (
  actual,
  expected
) {
  const value = actual as Record<string, any>;
  const hint = this.utils.matcherHint(
    this.isNot ? ".not.toStrictEqualTyped" : "toStrictEqualTyped",
    "value",
    "expected",
    { isNot: this.isNot, promise: this.promise }
  );

  const serializableProperties = getSerializableProperties(value);

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
