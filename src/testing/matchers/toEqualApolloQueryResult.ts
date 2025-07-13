import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";
import type { ApolloQueryResult } from "../../core/index.js";

export const toEqualApolloQueryResult: MatcherFunction<
  [queryResult: ApolloQueryResult<any>]
> = function (actual, expected) {
  const queryResult = actual as ApolloQueryResult<any>;
  const hint = this.utils.matcherHint(
    this.isNot ? ".not.toEqualApolloQueryResult" : "toEqualApolloQueryResult",
    "queryResult",
    "expected",
    { isNot: this.isNot, promise: this.promise }
  );

  const pass = this.equals(
    queryResult,
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
          queryResult,
          "Expected",
          "Received",
          true
        )
      );
    },
  };
};
