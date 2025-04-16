import type { ErrorLike } from "@apollo/client";

import { brand, isBranded } from "./utils.js";

/**
 * A wrapper error type that wraps errors emitted from the link chain. Useful if
 * you have custom error types in your application and you want to differentiate
 * errors that come from the link chain.
 */
export class NetworkError extends Error {
  /** Determine if an error is a `NetworkError` instance */
  static is(error: unknown): error is NetworkError {
    return isBranded(error, "NetworkError");
  }

  constructor(sourceError: ErrorLike) {
    super(sourceError.message, { cause: sourceError });
    this.name = "NetworkError";

    brand(this);
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
