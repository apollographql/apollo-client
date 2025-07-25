import { brand, isBranded } from "./utils.js";

export declare namespace ServerError {
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
       * The status code returned by the server in the response. This is provided as
       * a shortcut for `response.status`.
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
 * Represents an error when a non-200 HTTP status code is returned from the
 * server according to the [GraphQL Over HTTP specification](https://graphql.github.io/graphql-over-http/draft/). This error
 * contains the full server response, including status code and body text.
 *
 * @remarks
 *
 * This error occurs when your GraphQL server responds with an HTTP status code
 * other than 200 (such as 4xx or 5xx status codes) with any media type other
 * than [`application/graphql-response+json`](https://graphql.github.io/graphql-over-http/draft/#sec-application-graphql-response-json).
 *
 * Servers that return non-200 status codes with other media types are not
 * guaranteed to contain a well-formed GraphQL response and may indicate issues
 * at the HTTP level, such as authentication failures, server unavailability,
 * or other HTTP-level problems.
 *
 * @example
 *
 * ```ts
 * import { ServerError } from "@apollo/client/errors";
 *
 * // Check if an error is a ServerError instance
 * if (ServerError.is(error)) {
 *   console.log(`Server returned status: ${error.statusCode}`);
 *   console.log(`Response body: ${error.bodyText}`);
 *
 *   // Handle specific status codes
 *   if (error.statusCode === 401) {
 *     // Handle unauthorized access
 *   }
 * }
 * ```
 */
export class ServerError extends Error {
  /**
   * A method that determines whether an error is a `ServerError` object. This
   * method enables TypeScript to narrow the error type.
   *
   * @example
   *
   * ```ts
   * if (ServerError.is(error)) {
   *   // TypeScript now knows `error` is a ServerError object
   *   console.log(error.errors);
   * }
   * ```
   */
  static is(error: unknown): error is ServerError {
    return isBranded(error, "ServerError");
  }

  /** {@inheritDoc @apollo/client!ServerError.DocumentationTypes.InstanceProperties#response:member} */
  readonly response: Response;

  /** {@inheritDoc @apollo/client!ServerError.DocumentationTypes.InstanceProperties#statusCode:member} */
  readonly statusCode: number;

  /** {@inheritDoc @apollo/client!ServerError.DocumentationTypes.InstanceProperties#bodyText:member} */
  readonly bodyText: string;

  constructor(message: string, options: ServerError.Options) {
    super(message);
    this.name = "ServerError";
    this.response = options.response;
    this.statusCode = options.response.status;
    this.bodyText = options.bodyText;

    brand(this);
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}
