import { hasName } from "./utils.js";

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
    return (
      error instanceof ServerParseError ||
      // Fallback to check for the name in case there are multiple versions of
      // Apollo Client installed, or something else causes instanceof to
      // return false.
      hasName(error, "ServerParseError")
    );
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

    Object.setPrototypeOf(this, ServerParseError.prototype);
  }
}
