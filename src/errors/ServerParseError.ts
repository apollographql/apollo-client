import { brand, isBranded } from "./utils.js";

interface ServerParseErrorOptions {
  response: Response;
  bodyText: string;
}

/**
 * Represents a failure to parse the response as JSON from the server. This error
 * helps debug issues where the server returns malformed JSON or non-JSON content.
 */
export class ServerParseError extends Error {
  /** Determine if an error is an `ServerParseError` instance */
  static is(error: unknown): error is ServerParseError {
    return isBranded(error, "ServerParseError");
  }
  /**
   * The raw `Response` object returned by the Fetch API.
   */
  response: Response;
  /**
   * The status code returned from the server. This is provided as a shortcut
   * for `serverParseError.response.status`.
   */
  statusCode: number;
  /**
   * The raw response body text.
   */
  bodyText: string;

  constructor(originalParseError: unknown, options: ServerParseErrorOptions) {
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
