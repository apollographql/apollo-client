import type { GraphQLFormattedError } from "graphql";

import type { FetchResult } from "@apollo/client";
import { getGraphQLErrorsFromResult } from "@apollo/client/utilities";

/**
 * Represents the combined list of GraphQL errors returned from the server in a
 * GraphQL response.
 */
export class CombinedGraphQLErrors extends Error {
  /**
   * The raw list of GraphQL errors returned in a GraphQL response.
   */
  readonly errors: ReadonlyArray<GraphQLFormattedError>;

  /**
   * Partial data returned in the GraphQL response.
   */
  readonly data: Record<string, unknown> | null | undefined;

  constructor(result: FetchResult<unknown>) {
    const errors = getGraphQLErrorsFromResult(result);

    super(formatMessage(errors));
    this.errors = errors;
    this.data = result.data as Record<string, unknown>;
    this.name = "CombinedGraphQLErrors";

    Object.setPrototypeOf(this, CombinedGraphQLErrors.prototype);
  }
}

function formatMessage(
  errors: Array<GraphQLFormattedError> | ReadonlyArray<GraphQLFormattedError>
) {
  const messageList = errors
    // Handle non-spec-compliant servers: See #1185
    .filter((e) => e)
    .map((e) => `- ${e.message}`)
    .join("\n");

  return `The GraphQL server returned with errors:
${messageList}`;
}
