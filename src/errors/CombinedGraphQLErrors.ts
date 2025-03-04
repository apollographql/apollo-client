import type { GraphQLFormattedError } from "graphql";

export class CombinedGraphQLErrors extends Error {
  errors: Array<GraphQLFormattedError>;

  constructor(errors: Array<GraphQLFormattedError>) {
    super(formatMessage(errors));
    this.errors = errors;
    this.name = "CombinedGraphQLErrors";
  }
}

function formatMessage(errors: Array<GraphQLFormattedError>) {
  const messageList = errors
    // Handle non-spec-compliant servers: See #1185
    .filter((e) => e)
    .map((e) => `- ${e.message}`)
    .join("\n");

  return `The GraphQL server returned with errors:
${messageList}`;
}
