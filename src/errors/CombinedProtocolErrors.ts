import type { GraphQLFormattedError } from "graphql";

/**
 * Fatal transport-level errors returned when executing a subscription using the
 * multipart HTTP subscription protocol. See the documentation on the
 * [multipart HTTP protocol for GraphQL Subscriptions](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol) for more information on these errors.
 */
export class CombinedProtocolErrors extends Error {
  errors: ReadonlyArray<GraphQLFormattedError>;

  constructor(protocolErrors: Array<GraphQLFormattedError>) {
    super(formatMessage(protocolErrors));
    this.name = "CombinedProtocolErrors";
    this.errors = protocolErrors;

    Object.setPrototypeOf(this, CombinedProtocolErrors.prototype);
  }
}

function formatMessage(errors: Array<GraphQLFormattedError>) {
  const messageList = errors.map((e) => `- ${e.message}`).join("\n");

  return `The GraphQL server returned with errors:
${messageList}`;
}
