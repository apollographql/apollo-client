import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";
import type { LazyQueryResult } from "../../react/index.js";
import { OperationVariables } from "../../core/types.js";

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

export type CheckedLazyQueryResult<
  TData,
  TVariables extends OperationVariables,
> = Pick<LazyQueryResult<TData, TVariables>, (typeof CHECKED_KEYS)[number]>;

const hasOwnProperty = (obj: Record<string, any>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const toEqualLazyQueryResult: MatcherFunction<
  [lazyQueryResult: CheckedLazyQueryResult<any, any>]
> = function (actual, expected) {
  const lazyQueryResult = actual as LazyQueryResult<any, any>;
  const hint = this.utils.matcherHint(
    this.isNot ? ".not.toEqualLazyQueryResult" : "toEqualLazyQueryResult",
    "lazyQueryResult",
    "expected",
    { isNot: this.isNot, promise: this.promise }
  );

  const checkedLazyQueryResult = CHECKED_KEYS.reduce(
    (memo, key) => {
      if (hasOwnProperty(lazyQueryResult, key)) {
        memo[key] = lazyQueryResult[key];
      }

      return memo;
    },
    {} as Partial<LazyQueryResult<any, any>>
  );

  const pass = this.equals(
    checkedLazyQueryResult,
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
          checkedLazyQueryResult,
          "Expected",
          "Received",
          true
        )
      );
    },
  };
};
