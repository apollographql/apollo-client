import type { FormattedExecutionResult, GraphQLFormattedError } from "graphql";

import type { ApolloLink } from "@apollo/client/link";

import { brand, isBranded } from "./utils.js";

export declare namespace CombinedGraphQLErrors {
  export interface MessageFormatterOptions {
    /**
     * The raw result returned from the server.
     */
    result: ApolloLink.Result<unknown>;

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
     * CombinedGraphQLErrors.formatMessage = (errors, { defaultFormatMessage }) => {
     *   return `[GraphQL errors]: ${defaultFormatMessage(errors)}`;
     * };
     * ```
     */
    defaultFormatMessage: (
      errors: ReadonlyArray<GraphQLFormattedError>
    ) => string;
  }

  /**
   * By default, `CombinedGraphQLErrors` formats the `message` property by
   * joining each error's `message` field with a newline. To customize the
   * format of the `message`, such as changing the delimiter or adding a message
   * prefix, override the static `formatMessage` method.
   *
   * @example
   *
   * The following example demonstrates how to format the error message by
   * joining each error with a comma.
   *
   * ```ts
   * import { CombinedGraphQLErrors } from "@apollo/client/errors";
   *
   * CombinedGraphQLErrors.formatMessage = (errors) => {
   *   return errors.map((error) => error.message).join(", ");
   * };
   * ```
   *
   * @remarks
   *
   * See the [`formatMessage`](https://www.apollographql.com/docs/react/api/errors/CombinedGraphQLErrors#formatmessage) docs for details about the parameters provided to the `formatMessage` function.
   *
   * > [!NOTE]
   * > The message formatter needs to be configured before any operation is executed by Apollo Client, otherwise the default message formatter is used. We recommend configuring the message formatter before initializing your `ApolloClient` instance.
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
     * The `formatMessage` function is called by the `CombinedGraphQLErrors`
     * constructor to provide a formatted message as the `message` property of the
     * `CombinedGraphQLErrors` object. Follow the ["Providing a custom message
     * formatter"](https://www.apollographql.com/docs/react/api/errors/CombinedGraphQLErrors#providing-a-custom-message-formatter) guide to learn how to modify the message format.
     *
     * @param errors - The array of GraphQL errors returned from the server in
     * the `errors` field of the response.
     * @param options - Additional context that could be useful when formatting
     * the message.
     */
    function formatMessage(
      errors: ReadonlyArray<GraphQLFormattedError>,
      options: MessageFormatterOptions
    ): string;

    interface InstanceProperties {
      /**
       * The raw list of GraphQL errors returned by the `errors` field in the GraphQL response.
       */
      readonly errors: ReadonlyArray<GraphQLFormattedError>;

      /**
       * Partial data returned in the `data` field of the GraphQL response.
       */
      readonly data: Record<string, unknown> | null | undefined;

      /**
       * Extensions returned by the `extensions` field in the GraphQL response.
       */
      readonly extensions: Record<string, unknown> | undefined;
    }

    /**
     * A method that determines whether an error is a `{{errorClass}}`
     * object. This method enables TypeScript to narrow the error type.
     *
     * @example
     *
     * ```ts
     * if ({{errorClass}}.is(error)) {
     *   // TypeScript now knows `error` is a `{{errorClass}}` object
     *   console.log(error.errors);
     * }
     * ```
     */
    function is(error: unknown): boolean;
  }
}

function defaultFormatMessage(errors: ReadonlyArray<GraphQLFormattedError>) {
  return (
    errors
      // Handle non-spec-compliant servers: See #1185
      .filter((e) => e)
      .map((e) => e.message || "Error message not found.")
      .join("\n")
  );
}

/**
 * Represents the combined list of GraphQL errors returned from the server in a
 * GraphQL response. This error type is used when your GraphQL operation returns
 * errors in the `errors` field of the response.
 *
 * @remarks
 *
 * When your GraphQL operation encounters errors on the server side (such as
 * resolver errors, validation errors, or syntax errors), the server returns
 * these errors in the `errors` array of the GraphQL response. Apollo Client
 * wraps these errors in a `CombinedGraphQLErrors` object, which provides access
 * to the individual errors while maintaining additional context about the
 * response.
 *
 * @example
 *
 * ```ts
 * import { CombinedGraphQLErrors } from "@apollo/client/errors";
 *
 * // Check if an error is a CombinedGraphQLErrors object
 * if (CombinedGraphQLErrors.is(error)) {
 *   // Access individual GraphQL errors
 *   error.errors.forEach((graphQLError) => {
 *     console.log(graphQLError.message);
 *     console.log(graphQLError.path);
 *     console.log(graphQLError.locations);
 *   });
 *
 *   // Access the original GraphQL result
 *   console.log(error.result);
 * }
 * ```
 */
export class CombinedGraphQLErrors extends Error {
  /**
   * {@inheritDoc @apollo/client!CombinedGraphQLErrors.DocumentationTypes.is:function(1) {"errorClass":"CombinedGraphQLErrors"}}
   */
  static is(error: unknown): error is CombinedGraphQLErrors {
    return isBranded(error, "CombinedGraphQLErrors");
  }

  /** {@inheritDoc @apollo/client!CombinedGraphQLErrors.DocumentationTypes.formatMessage:function(1)} */
  static formatMessage: CombinedGraphQLErrors.MessageFormatter =
    defaultFormatMessage;

  /** {@inheritDoc @apollo/client!CombinedGraphQLErrors.DocumentationTypes.InstanceProperties#errors:member} */
  readonly errors: ReadonlyArray<GraphQLFormattedError>;

  /** {@inheritDoc @apollo/client!CombinedGraphQLErrors.DocumentationTypes.InstanceProperties#data:member} */
  readonly data: Record<string, unknown> | null | undefined;

  /** {@inheritDoc @apollo/client!CombinedGraphQLErrors.DocumentationTypes.InstanceProperties#extensions:member} */
  readonly extensions: Record<string, unknown> | undefined;

  constructor(result: FormattedExecutionResult<any>);
  constructor(
    result: ApolloLink.Result<any>,
    errors: ReadonlyArray<GraphQLFormattedError>
  );

  constructor(
    result: ApolloLink.Result<any> | FormattedExecutionResult<any>,
    errors = (result as FormattedExecutionResult<any>).errors || []
  ) {
    super(
      CombinedGraphQLErrors.formatMessage(errors, {
        result,
        defaultFormatMessage,
      })
    );
    this.errors = errors;
    this.data = (result as Partial<FormattedExecutionResult>).data;
    this.extensions = (result as Partial<FormattedExecutionResult>).extensions;
    this.name = "CombinedGraphQLErrors";

    brand(this);
    Object.setPrototypeOf(this, CombinedGraphQLErrors.prototype);
  }
}
