import { brand, isBranded } from "./utils.js";

/**
 * Represents an error when executing the `LocalResolversLink`.
 */
export class LocalResolversError extends Error {
  /** Determine if an error is a `LocalResolversError` instance */
  static is(error: unknown): error is LocalResolversError {
    return isBranded(error, "LocalResolversError");
  }

  constructor(message: string) {
    super(message);
    this.name = "LocalResolversError";

    brand(this);
    Object.setPrototypeOf(this, LocalResolversError.prototype);
  }
}
