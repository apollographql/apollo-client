import type { MatcherFunction } from "expect";

export const arrayWithLength: MatcherFunction<[length: number]> = function (
  actual,
  length
) {
  if (!Array.isArray(actual)) {
    throw new Error("Actual value must be an array");
  }

  const pass = actual.length === length;

  return {
    pass,
    message: () =>
      `expected array to ${pass ? "not be" : "be"} of length ${length}`,
  };
};
