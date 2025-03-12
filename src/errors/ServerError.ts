interface ServerErrorOptions {
  response: Response;
  result: Record<string, any> | string;
}

/**
 * Thrown when a non-200 response is returned from the server.
 */
export class ServerError extends Error {
  /**
   * The server response.
   */
  response: Response;
  /**
   * The status code returned from the server.
   */
  statusCode: number;

  /**
   * The JSON-parsed response body or raw body text if the text is not JSON
   * parseable.
   */
  result: Record<string, any> | string;

  constructor(message: string, options: ServerErrorOptions) {
    super(message);
    this.name = "ServerError";
    this.response = options.response;
    this.statusCode = options.response.status;
    this.result = options.result;

    Object.setPrototypeOf(this, ServerError.prototype);
  }
}
