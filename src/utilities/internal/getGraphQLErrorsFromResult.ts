import type { GraphQLFormattedError } from "graphql";

/** @internal */
export function getGraphQLErrorsFromResult(result: {
  errors?: ReadonlyArray<GraphQLFormattedError>;
}): Array<GraphQLFormattedError> {
  return [...(result.errors || [])];
}
