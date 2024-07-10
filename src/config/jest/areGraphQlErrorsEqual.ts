import type { GraphQLFormattedError } from "graphql";
import { GraphQLError } from "graphql";
import type { Tester } from "@jest/expect-utils";
function isGraphQLFormattedError(e: any): e is GraphQLFormattedError {
  return (
    e &&
    typeof e.message === "string" &&
    (typeof e.locations === "undefined" || Array.isArray(e.locations)) &&
    (typeof e.path === "undefined" || Array.isArray(e.path)) &&
    (typeof e.extensions === "undefined" || typeof e.extensions === "object")
  );
}

// eslint-disable-next-line @typescript-eslint/ban-types
function isGraphQLError(e: any): e is GraphQLError {
  return e instanceof GraphQLError;
}

export const areGraphQLErrorsEqual: Tester = function (a, b, customTesters) {
  /*
  we want the user to trigger this tester by passing in a `GraphQLError`
  instance as the `.toEqual` argument.

  This one will not trigger this Tester and should pass:
  `GraphQLError` is an `Error` and the message matches
  ```js
  expect(new GraphQLError("foo")).toEqual(new Error("foo"));
  ```
  in this case, we want this tester to take a closer look
  this test will fail
  ```js
  expect(new Error("foo")).toEqual(new GraphQLError("foo"));
  ```
  */
  if (!isGraphQLError(b)) return undefined;

  a = isGraphQLError(a) ? a.toJSON() : a;
  b = isGraphQLError(b) ? b.toJSON() : b;

  if (!isGraphQLFormattedError(a) && !isGraphQLFormattedError(b))
    return undefined;

  return this.equals(a, b, customTesters);
};
