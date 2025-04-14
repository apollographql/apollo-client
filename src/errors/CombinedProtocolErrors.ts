import type { GraphQLFormattedError } from "graphql";

import { brand, isBranded } from "./utils.js";

export type CombinedGraphQLErrorsMessageFormatter = (
  errors: ReadonlyArray<GraphQLFormattedError>
) => string;

/**
 * Fatal transport-level errors returned when executing a subscription using the
 * multipart HTTP subscription protocol. See the documentation on the
 * [multipart HTTP protocol for GraphQL Subscriptions](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol) for more information on these errors.
 */
export class CombinedProtocolErrors extends Error {
  /** Determine if an error is a `CombinedProtocolErrors` instance */
  static is(error: unknown): error is CombinedProtocolErrors {
    return isBranded(error, "CombinedProtocolErrors");
  }

  static formatMessage: CombinedGraphQLErrorsMessageFormatter = (errors) => {
    const messageList = errors.map((e) => `- ${e.message}`).join("\n");

    return `The GraphQL server returned with errors:
${messageList}`;
  };

  errors: ReadonlyArray<GraphQLFormattedError>;

  constructor(
    protocolErrors:
      | Array<GraphQLFormattedError>
      | ReadonlyArray<GraphQLFormattedError>
  ) {
    super(CombinedProtocolErrors.formatMessage(protocolErrors));
    this.name = "CombinedProtocolErrors";
    this.errors = protocolErrors;

    brand(this);
    Object.setPrototypeOf(this, CombinedProtocolErrors.prototype);
  }
}
