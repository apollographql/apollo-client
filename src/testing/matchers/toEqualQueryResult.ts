import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";
import type { QueryResult } from "../../react/index.js";

const CHECKED_KEYS = [
  "loading",
  "error",
  "errors",
  "data",
  "variables",
  "networkStatus",
  "errors",
  "called",
  "previousData",
] as const;

export type CheckedKeys = (typeof CHECKED_KEYS)[number];

const hasOwnProperty = (obj: Record<string, any>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const toEqualQueryResult: MatcherFunction<
  [queryResult: Pick<QueryResult<any, any>, CheckedKeys>]
> = function (actual, expected) {
  const queryResult = actual as QueryResult<any, any>;
  const hint = this.utils.matcherHint(
    this.isNot ? ".not.toEqualQueryResult" : "toEqualQueryResult",
    "queryResult",
    "expected",
    { isNot: this.isNot, promise: this.promise }
  );

  const checkedQueryResult = CHECKED_KEYS.reduce(
    (memo, key) => {
      if (hasOwnProperty(queryResult, key)) {
        memo[key] = queryResult[key];
      }

      return memo;
    },
    {} as Partial<QueryResult<any, any>>
  );

  const pass = this.equals(
    checkedQueryResult,
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
          checkedQueryResult,
          "Expected",
          "Received",
          true
        )
      );
    },
  };
};
