import { FetchResult } from "../../link/core";
import { isNonEmptyArray } from "../../utilities/common/arrays";
import { isExecutionPatchIncrementalResult } from "../../utilities/common/incrementalResult";

export function graphQLResultHasError<T>(result: FetchResult<T>): boolean {
  const errors = getGraphQLErrorsFromResult(result);
  return isNonEmptyArray(errors);
}

export function getGraphQLErrorsFromResult<T>(result: FetchResult<T>) {
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
