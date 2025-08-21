import type { GraphQLFormattedError } from "graphql";

import { brand, isBranded } from "./utils.js";

export declare namespace CombinedProtocolErrors {
  export interface MessageFormatterOptions {
    /**
     * The default message formatter. Call this to get a string with the default
     * formatted message.
     *
     * @remarks
     * To format part of the message using the default message formatter, call
     * the `defaultFormatMessage` function provided to the `options` argument of
     * your message formatter.
     *
     * @example
     *
     * The following example prepends a string to the message and uses the
     * default message formatter to format the error messages.
     *
     * ```ts
     * CombinedProtocolErrors.formatMessage = (errors, { defaultFormatMessage }) => {
     *   return `[Protocol errors]: ${defaultFormatMessage(errors)}`;
     * };
     * ```
     */
    defaultFormatMessage: (
      errors: ReadonlyArray<GraphQLFormattedError>
    ) => string;
  }

  /**
   * By default, `CombinedProtocolErrors` formats the `message` property by
   * joining each error's `message` field with a newline. To customize the
   * format of the `message`, such as changing the delimiter or adding a message
   * prefix, override the static `formatMessage` method.
   *
   * @remarks
   *
   * See the [`formatMessage`](https://www.apollographql.com/docs/react/api/errors/CombinedProtocolErrors) section for details about the parameters provided to the `formatMessage` function.
   *
   * > [!NOTE]
   * > The message formatter needs to be configured before any operation is executed by Apollo Client, otherwise the default message formatter is used. We recommend configuring the message formatter before initializing your `ApolloClient` instance.
   *
   * @example
   *
   * The following example demonstrates how to format the error message by
   * joining each error with a comma.
   *
   * ```ts
   * import { CombinedProtocolErrors } from "@apollo/client/errors";
   *
   * CombinedProtocolErrors.formatMessage = (errors) => {
   *   return errors.map((error) => error.message).join(", ");
   * };
   * ```
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

  namespace DocumentationTypes {
    /**
     * A function that formats the error message used for the error's `message`
     * property. Override this method to provide your own formatting.
     *
     * @remarks
     *
     * The `formatMessage` function is called by the `CombinedProtocolErrors`
     * constructor to provide a formatted message as the `message` property of the
     * `CombinedProtocolErrors` object. Follow the ["Providing a custom message
     * formatter"](https://www.apollographql.com/docs/react/api/errors/CombinedProtocolErrors#providing-a-custom-message-formatter) guide to learn how to modify the message format.
     *
     * @param errors - The array of GraphQL errors returned from the server in the
     * `errors` field of the response.
     * @param options - Additional context that could be useful when formatting
     * the message.
     */
    function formatMessage(
      errors: ReadonlyArray<GraphQLFormattedError>,
      options: MessageFormatterOptions
    ): string;

    interface InstanceProperties {
      /**
       * The raw list of errors returned by the top-level `errors` field in the
       * multipart HTTP subscription response.
       */
      readonly errors: ReadonlyArray<GraphQLFormattedError>;
    }
  }
}

function defaultFormatMessage(errors: ReadonlyArray<GraphQLFormattedError>) {
  return errors.map((e) => e.message || "Error message not found.").join("\n");
}

/**
 * Fatal transport-level errors returned when executing a subscription using the
 * multipart HTTP subscription protocol. See the documentation on the
 * [multipart HTTP protocol for GraphQL Subscriptions](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol) for more information on these errors.
 *
 * @remarks
 *
 * These errors indicate issues with the subscription transport itself, rather
 * than GraphQL-level errors. They typically occur when there are problems
 * communicating with subgraphs from the Apollo Router.
 *
 * @example
 *
 * ```ts
 * import { CombinedProtocolErrors } from "@apollo/client/errors";
 *
 * // Check if an error is a CombinedProtocolErrors instance
 * if (CombinedProtocolErrors.is(error)) {
 *   // Access individual protocol errors
 *   error.errors.forEach((protocolError) => {
 *     console.log(protocolError.message);
 *     console.log(protocolError.extensions);
 *   });
 * }
 * ```
 */
export class CombinedProtocolErrors extends Error {
  /**
   * A method that determines whether an error is a `CombinedProtocolErrors`
   * object. This method enables TypeScript to narrow the error type.
   *
   * @example
   *
   * ```ts
   * if (CombinedProtocolErrors.is(error)) {
   *   // TypeScript now knows `error` is a CombinedProtocolErrors object
   *   console.log(error.errors);
   * }
   * ```
   */
  static is(error: unknown): error is CombinedProtocolErrors {
    return isBranded(error, "CombinedProtocolErrors");
  }

  /** {@inheritDoc @apollo/client!CombinedProtocolErrors.DocumentationTypes.formatMessage:function(1)} */
  static formatMessage: CombinedProtocolErrors.MessageFormatter =
    defaultFormatMessage;

  /** {@inheritDoc @apollo/client!CombinedProtocolErrors.DocumentationTypes.InstanceProperties#errors:member} */
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
