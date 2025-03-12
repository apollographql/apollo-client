interface ServerParseErrorOptions {
  response: Response;
  bodyText: string;
}

/**
 * Thrown when failing to parse the response as JSON from the server.
 */
export class ServerParseError extends Error {
  response: Response;
  statusCode: number;
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
