import { brand, isBranded } from "./utils.js";

export declare namespace ServerError {
  export interface Options {
    response: Response;
    bodyText: string;
  }
}

/**
 * Thrown when a non-200 response is returned from the server.
 */
export class ServerError extends Error {
  /** Determine if an error is a `ServerError` instance */
  static is(error: unknown): error is ServerError {
    return isBranded(error, "ServerError");
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
   * The raw response body text.
   */
  bodyText: string;

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
