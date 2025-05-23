import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";
import type { MatcherHintOptions } from "jest-matcher-utils";

import { isSameClient } from "./isSameClient.js";
import { isSameObservableQuery } from "./isSameObservableQuery.js";
import { getSerializableProperties } from "./utils/getSerializableProperties.js";

export const toStrictEqualTyped: MatcherFunction<
  [
    value: any,
    options?: {
      includeKnownClassInstances?: boolean;
      received?: string;
      expected?: string;
      hintOptions?: MatcherHintOptions;
    },
  ]
> = function (actual, expected, options = {}) {
  const { includeKnownClassInstances = false } = options;
  const value = actual as Record<string, any>;
  const hint = this.utils.matcherHint(
    this.isNot ? ".not.toStrictEqualTyped" : "toStrictEqualTyped",
    options?.received || "value",
    options?.expected || "expected",
    { ...options.hintOptions, isNot: this.isNot, promise: this.promise }
  );

  const serializableProperties = getSerializableProperties(value, {
    includeKnownClassInstances,
  });

  const testers =
    includeKnownClassInstances ? [isSameClient, isSameObservableQuery] : [];

  const pass = this.equals(
    serializableProperties,
    expected,
    // https://github.com/jestjs/jest/blob/22029ba06b69716699254bb9397f2b3bc7b3cf3b/packages/expect/src/matchers.ts#L62-L67
    [...testers, ...this.customTesters, iterableEquality],
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
