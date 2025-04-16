import { isErrorLike } from "./isErrorLike.js";
import { brand, isBranded } from "./utils.js";

/**
 * A wrapper error type that wraps errors emitted from the link chain. Useful if
 * you have custom error types in your application want to differentiate
 * errors that come specifically from the link chain.
 *
 * Inspect the `cause` to get the original source of the error.
 */
export class NetworkError extends Error {
  /** Determine if an error is a `NetworkError` instance */
  static is(error: unknown): error is NetworkError {
    return isBranded(error, "NetworkError");
  }

  constructor(sourceError: unknown) {
    super(getErrorMessage(sourceError), { cause: sourceError });
    this.name = "NetworkError";

    brand(this);
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

function getErrorMessage(sourceError: unknown): string {
  if (isErrorLike(sourceError)) {
    return sourceError.message;
  }

  if (typeof sourceError === "string") {
    return sourceError;
  }

  return "An error of unexpected shape occurred.";
}
