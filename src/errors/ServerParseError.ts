import { brand, isBranded } from "./utils.js";

interface ServerParseErrorOptions {
  response: Response;
  bodyText: string;
}

/**
 * Thrown when failing to parse the response as JSON from the server.
 */
export class ServerParseError extends Error {
  /** Determine if an error is an `ServerParseError` instance */
  static is(error: unknown): error is ServerParseError {
    return isBranded(error, "ServerParseError");
  }
  /**
   * The server response.
   */
  response: Response;
  /**
   * The status code returned from the server.
   */
  statusCode: number;
  /**
   * The raw body text returned in the server response.
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
