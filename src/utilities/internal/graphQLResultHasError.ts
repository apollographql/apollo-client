import type { FetchResult } from "@apollo/client/link";

/** @internal */
export function graphQLResultHasError(result: FetchResult<any>): boolean {
  return !!result.errors?.length;
}
