import type { GraphQLFormattedError } from "graphql";

import { brand, isBranded } from "./utils.js";

export declare namespace CombinedProtocolErrors {
  export interface MessageFormatterOptions {
    /**
     * The default message formatter. Call this to get a string with the
     * default formatted message.
     */
    defaultFormatMessage: (
      errors: ReadonlyArray<GraphQLFormattedError>
    ) => string;
  }

  /**
   * A function used to format the message string set on the
   * `CombinedProtocolErrors` object. Override the static `formatMessage`
   * method to provide a custom message formatter.
   *
   * @param errors - The array of GraphQL errors returned from the server in the
   * `errors` field of the response.
   * @param options - Additional context that could be useful when formatting
   * the message.
   */
  export type MessageFormatter = (
    errors: ReadonlyArray<GraphQLFormattedError>,
    options: MessageFormatterOptions
  ) => string;
}

function defaultFormatMessage(errors: ReadonlyArray<GraphQLFormattedError>) {
  return errors.map((e) => e.message || "Error message not found.").join("\n");
}

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

  /**
   * Formats the error message used for the error `message` property. Override
   * to provide your own formatting.
   */
  static formatMessage: CombinedProtocolErrors.MessageFormatter =
    defaultFormatMessage;

  /**
   * The raw list of errors returned by the top-level `errors` field in the
   * multipart HTTP subscription response.
   */
  readonly errors: ReadonlyArray<GraphQLFormattedError>;

  constructor(
    protocolErrors:
      | Array<GraphQLFormattedError>
      | ReadonlyArray<GraphQLFormattedError>
  ) {
    super(
      CombinedProtocolErrors.formatMessage(protocolErrors, {
        defaultFormatMessage,
      })
    );
    this.name = "CombinedProtocolErrors";
    this.errors = protocolErrors;

    brand(this);
    Object.setPrototypeOf(this, CombinedProtocolErrors.prototype);
  }
}
