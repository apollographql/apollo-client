import type { ErrorLike } from "@apollo/client";

/**
 * A wrapper error type that represents a non-standard error thrown from a
 * response, such as a symbol or plain object. Read the `cause` property to
 * determine the source of the error.
 */
export class UnconventionalError extends Error {
  /** Determine if an error is an `UnconventionalError` instance */
  static is(error: ErrorLike): error is UnconventionalError {
    return (
      error instanceof UnconventionalError ||
      // Fallback to check for the name property in case there are multiple
      // versions of Apollo Client installed, or something else causes
      // instanceof to return false.
      error.name === "UnconventionalError"
    );
  }

  constructor(errorType: unknown) {
    super("An error of unexpected shape occurred.", { cause: errorType });
    this.name = "UnconventionalError";

    Object.setPrototypeOf(this, UnconventionalError.prototype);
  }
}
