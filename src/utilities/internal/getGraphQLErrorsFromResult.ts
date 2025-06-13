import type { FetchResult } from "@apollo/client/link";

import { isExecutionPatchIncrementalResult } from "./isExecutionPatchIncrementalResult.js";
import { isNonEmptyArray } from "./isNonEmptyArray.js";

/** @internal */
export function getGraphQLErrorsFromResult<T>(result: FetchResult<T>) {
  // this method should not be used anymore once we're done with this PR
  // TODO remove it then
  const graphQLErrors =
    isNonEmptyArray(result.errors) ? result.errors.slice(0) : [];

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
