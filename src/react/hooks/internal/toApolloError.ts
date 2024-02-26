import type { ApolloQueryResult } from "../../../core/index.js";
import { ApolloError } from "../../../core/index.js";
import { isNonEmptyArray } from "../../../utilities/index.js";

export function toApolloError(result: ApolloQueryResult<any>) {
  return isNonEmptyArray(result.errors) ?
      new ApolloError({ graphQLErrors: result.errors })
    : result.error;
}
