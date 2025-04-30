import type { ApolloPayloadResult } from "@apollo/client/link";

import { isNonNullObject } from "./isNonNullObject.js";

/**
 * This function detects an Apollo payload result before it is transformed
 * into a FetchResult via HttpLink; it cannot detect an ApolloPayloadResult
 * once it leaves the link chain.
 *
 * @internal
 */
export function isApolloPayloadResult(
  value: unknown
): value is ApolloPayloadResult {
  return isNonNullObject(value) && "payload" in value;
}
