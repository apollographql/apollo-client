import type { FetchResult } from "@apollo/client/link";

import { getGraphQLErrorsFromResult } from "./getGraphQLErrorsFromResult.js";
import { isNonEmptyArray } from "./isNonEmptyArray.js";

/** @internal */
export function graphQLResultHasError(result: FetchResult<any>): boolean {
  const errors = getGraphQLErrorsFromResult(result);
  return isNonEmptyArray(errors);
}
