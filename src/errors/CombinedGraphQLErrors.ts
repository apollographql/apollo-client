import type { GraphQLFormattedError } from "graphql";

export class CombinedGraphQLErrors extends Error {
  errors: ReadonlyArray<GraphQLFormattedError>;

  constructor(
    errors: Array<GraphQLFormattedError> | ReadonlyArray<GraphQLFormattedError>
  ) {
    super(formatMessage(errors));
    this.errors = errors;
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
