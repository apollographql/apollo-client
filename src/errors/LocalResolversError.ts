import { brand, isBranded } from "./utils.js";

export declare namespace LocalResolversError {
  export interface Options {
    path?: Array<string | number>;
    sourceError?: unknown;
  }
}

/**
 * Represents an error when executing the `LocalResolversLink`.
 */
export class LocalResolversError extends Error {
  /** Determine if an error is a `LocalResolversError` instance */
  static is(error: unknown): error is LocalResolversError {
    return isBranded(error, "LocalResolversError");
  }

  /**
   * The path to the field that caused the error, if the error is caused by a
   * field.
   */
  readonly path?: Array<string | number>;

  constructor(message: string, options: LocalResolversError.Options = {}) {
    super(message, { cause: options.sourceError });
    this.name = "LocalResolversError";
    this.path = options.path;

    brand(this);
    Object.setPrototypeOf(this, LocalResolversError.prototype);
  }
}
