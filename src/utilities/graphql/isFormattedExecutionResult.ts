import type { FormattedExecutionResult } from "graphql";

/**
 * Determines whether the given object is a valid GraphQL execution result
 * according to the GraphQL specification.
 *
 * @remarks
 *
 * A valid execution result must be an object that contains only `data`,
 * `errors`, and/or `extensions` properties. At least one of `data` or `errors`
 * must be present.
 *
 * @param result - The object to test
 * @returns `true` if the object conforms to the GraphQL execution result format
 *
 * @example
 *
 * ```ts
 * import { isFormattedExecutionResult } from "@apollo/client/utilities";
 *
 * // Valid execution result
 * const validResult = { data: { user: { name: "John" } } };
 * console.log(isFormattedExecutionResult(validResult)); // true
 *
 * // Invalid - contains non-standard properties
 * const invalidResult = { data: {}, customField: "value" };
 * console.log(isFormattedExecutionResult(invalidResult)); // false
 * ```
 */
export function isFormattedExecutionResult(
  result?: object
): result is FormattedExecutionResult {
  return (
    !!result &&
    ("errors" in result || "data" in result) &&
    Object.keys(result).every(
      (key) => key === "errors" || key === "data" || key === "extensions"
    )
  );
}
