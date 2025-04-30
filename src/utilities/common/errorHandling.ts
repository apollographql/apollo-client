import type { FetchResult } from "@apollo/client/link";
import {
  getGraphQLErrorsFromResult,
  isNonEmptyArray,
} from "@apollo/client/utilities/internal";

export function graphQLResultHasError<T>(result: FetchResult<T>): boolean {
  const errors = getGraphQLErrorsFromResult(result);
  return isNonEmptyArray(errors);
}
