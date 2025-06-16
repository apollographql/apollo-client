import type { FormattedExecutionResult } from "graphql";

/** @internal */
export function graphQLResultHasError(
  result: FormattedExecutionResult<any>
): boolean {
  return !!result.errors?.length;
}
