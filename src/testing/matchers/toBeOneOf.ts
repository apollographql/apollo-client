import type { MatcherFunction } from "expect";

export const toBeOneOf: MatcherFunction<[values: unknown[]]> = function (
  actual,
  values
) {
  const pass = values.some((value) =>
    this.equals(value, actual, this.customTesters)
  );

  return {
    pass,
    message: () => {
      const hint = this.utils.matcherHint("toBeOneOf", undefined, undefined, {
        isNot: this.isNot,
      });

      return `${hint}\n\nExpected value ${
        pass ? "not " : ""
      }to be one of:\n${this.utils.printExpected(
        values
      )}\n\nReceived:\n${this.utils.printReceived(actual)}`;
    },
  };
};
