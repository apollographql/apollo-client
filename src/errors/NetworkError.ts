import type { ErrorLike } from "@apollo/client";

import { brand, isBranded } from "./utils.js";

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
