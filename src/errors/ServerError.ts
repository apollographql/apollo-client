import { brand, isBranded } from "./utils.js";

export declare namespace ServerError {
  export interface Options {
    response: Response;
    bodyText: string;
  }
}

/**
 * Reprents an error when a non-200 HTTP status code is returned from the server.
 * This error contains the full server response, including status code and body
 * text.
 */
export class ServerError extends Error {
  /** Determine if an error is a `ServerError` instance */
  static is(error: unknown): error is ServerError {
    return isBranded(error, "ServerError");
  }

  /**
   * The raw `Response` object returned by the Fetch API.
   */
  response: Response;
  /**
   * The status code returned from the server. This is provided as a shortcut
   * for `serverError.response.status`.
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
