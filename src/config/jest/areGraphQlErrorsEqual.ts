import type { Tester } from "@jest/expect-utils";
import { GraphQLError } from "graphql";

export const areGraphQLErrorsEqual: Tester = function (a, b, customTesters) {
  if (a instanceof GraphQLError || b instanceof GraphQLError) {
    return this.equals(
      a instanceof GraphQLError ? a.toJSON() : a,
      b instanceof GraphQLError ? b.toJSON() : b,
      customTesters
    );
  }
};
