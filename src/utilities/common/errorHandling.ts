import { FetchResult } from "../../link/core";
import { isNonEmptyArray } from "../../utilities";
import { isExecutionPatchIncrementalResult } from "../../utilities/common/incrementalResult";

export function graphQLResultHasError(result: FetchResult<unknown>): boolean {
  const errors = mergeGraphQLErrors(result);
  return isNonEmptyArray(errors);
}

export function mergeGraphQLErrors(result: FetchResult<unknown>) {
  const graphQLErrors = isNonEmptyArray(result.errors)
    ? result.errors.slice(0)
    : [];

  if (
    isExecutionPatchIncrementalResult(result) &&
    isNonEmptyArray(result.incremental)
  ) {
    result.incremental.forEach((incrementalResult) => {
      if (incrementalResult.errors) {
        graphQLErrors.push(...incrementalResult.errors);
      }
    });
  }
  return graphQLErrors;
}
