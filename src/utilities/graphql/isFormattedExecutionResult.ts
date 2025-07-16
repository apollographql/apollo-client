import type { FormattedExecutionResult } from "graphql";

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
