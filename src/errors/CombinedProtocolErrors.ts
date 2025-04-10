import type { GraphQLFormattedError } from "graphql";

import type { ErrorLike } from "@apollo/client";

/**
 * Fatal transport-level errors returned when executing a subscription using the
 * multipart HTTP subscription protocol. See the documentation on the
 * [multipart HTTP protocol for GraphQL Subscriptions](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol) for more information on these errors.
 */
export class CombinedProtocolErrors extends Error {
  /** Determine if an error is a `CombinedProtocolErrors` instance */
  static is(error: ErrorLike): error is CombinedProtocolErrors {
    return (
      error instanceof CombinedProtocolErrors ||
      // Fallback to check for the name property in case there are multiple
      // versions of Apollo Client installed, or something else causes
      // instanceof to return false.
      error.name === "CombinedProtocolErrors"
    );
  }

  errors: ReadonlyArray<GraphQLFormattedError>;

  constructor(
    protocolErrors:
      | Array<GraphQLFormattedError>
      | ReadonlyArray<GraphQLFormattedError>
  ) {
    super(formatMessage(protocolErrors));
    this.name = "CombinedProtocolErrors";
    this.errors = protocolErrors;

    Object.setPrototypeOf(this, CombinedProtocolErrors.prototype);
  }
}

function formatMessage(
  errors: Array<GraphQLFormattedError> | ReadonlyArray<GraphQLFormattedError>
) {
  const messageList = errors.map((e) => `- ${e.message}`).join("\n");

  return `The GraphQL server returned with errors:
${messageList}`;
}
