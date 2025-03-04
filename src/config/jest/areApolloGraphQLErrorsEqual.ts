import type { GraphQLErrors } from "../../errors/index.js";
import type { Tester } from "@jest/expect-utils";

function isGraphQLErrors(e: unknown): e is GraphQLErrors {
  return e instanceof Error && e.name == "GraphQLErrors";
}

export const areApolloGraphQLErrorsEqual: Tester = function (
  a,
  b,
  customTesters
) {
  const isAGraphQLErrors = isGraphQLErrors(a);
  const isBGraphQLErrors = isGraphQLErrors(b);

  if (isAGraphQLErrors && isBGraphQLErrors) {
    return (
      a.message === b.message && this.equals(a.errors, b.errors, customTesters)
    );
  } else if (isAGraphQLErrors === isBGraphQLErrors) {
    return undefined;
  } else {
    return false;
  }
};
