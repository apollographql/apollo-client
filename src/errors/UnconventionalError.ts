import { brand, isBranded } from "./utils.js";

/**
 * A wrapper error type that represents a non-standard error thrown from a
 * response, such as a symbol or plain object. Read the `cause` property to
 * determine the source of the error.
 */
export class UnconventionalError extends Error {
  /** Determine if an error is an `UnconventionalError` instance */
  static is(error: unknown): error is UnconventionalError {
    return isBranded(error, "UnconventionalError");
  }

  constructor(errorType: unknown) {
    super("An error of unexpected shape occurred.", { cause: errorType });
    this.name = "UnconventionalError";

    brand(this);
    Object.setPrototypeOf(this, UnconventionalError.prototype);
  }
}
