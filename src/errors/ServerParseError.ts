import { brand, isBranded } from "./utils.js";

export declare namespace ServerParseError {
  export interface Options {
    response: Response;
    bodyText: string;
  }

  namespace DocumentationTypes {
    interface InstanceProperties {
      /**
       * The raw [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object provided by the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
       */
      readonly response: Response;
      /**
       * The status code returned by the server in the response. This is provided
       * as a shortcut for `response.status`.
       */
      readonly statusCode: number;
      /**
       * The raw response body text.
       */
      readonly bodyText: string;
    }
  }
}

/**
 * Represents a failure to parse the response as JSON from the server. This
 * error helps debug issues where the server returns malformed JSON or non-JSON
 * content.
 *
 * @remarks
 *
 * This error occurs when Apollo Client receives a response from the server but
 * cannot parse it as valid JSON. This typically happens when the server returns
 * HTML error pages, plain text responses, or malformed JSON instead of the
 * expected GraphQL JSON response format.
 *
 * @example
 *
 * ```ts
 * import { ServerParseError } from "@apollo/client/errors";
 *
 * // Check if an error is a ServerParseError instance
 * if (ServerParseError.is(error)) {
 *   console.log(`Failed to parse response from ${error.response.url}`);
 *   console.log(`Raw response: ${error.bodyText}`);
 *   console.log(`Status code: ${error.statusCode}`);
 *
 *   // Access the original parse error
 *   console.log(`Parse error: ${error.cause}`);
 * }
 * ```
 */
export class ServerParseError extends Error {
  /**
   * A method that determines whether an error is a `ServerParseError`
   * object. This method enables TypeScript to narrow the error type.
   *
   * @example
   *
   * ```ts
   * if (ServerParseError.is(error)) {
   *   // TypeScript now knows `error` is a ServerParseError object
   *   console.log(error.statusCode);
   * }
   * ```
   */
  static is(error: unknown): error is ServerParseError {
    return isBranded(error, "ServerParseError");
  }
  /** {@inheritDoc @apollo/client!ServerParseError.DocumentationTypes.InstanceProperties#response:member} */
  readonly response: Response;

  /** {@inheritDoc @apollo/client!ServerParseError.DocumentationTypes.InstanceProperties#statusCode:member} */
  readonly statusCode: number;

  /** {@inheritDoc @apollo/client!ServerParseError.DocumentationTypes.InstanceProperties#bodyText:member} */
  readonly bodyText: string;

  constructor(originalParseError: unknown, options: ServerParseError.Options) {
    super(
      originalParseError instanceof Error ?
        originalParseError.message
      : "Could not parse server response",
      { cause: originalParseError }
    );
    this.name = "ServerParseError";
    this.response = options.response;
    this.statusCode = options.response.status;
    this.bodyText = options.bodyText;

    brand(this);
    Object.setPrototypeOf(this, ServerParseError.prototype);
  }
}
