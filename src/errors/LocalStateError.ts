import { brand, isBranded } from "./utils.js";

export declare namespace LocalStateError {
  export interface Options {
    path?: Array<string | number>;
    sourceError?: unknown;
  }
}

/**
 * Represents an error when executing `@client` fields from `LocalState`.
 */
export class LocalStateError extends Error {
  /** Determine if an error is a `LocalStateError` instance */
  static is(error: unknown): error is LocalStateError {
    return isBranded(error, "LocalStateError");
  }

  /**
   * The path to the field that caused the error, if the error is caused by a
   * field.
   */
  readonly path?: Array<string | number>;

  constructor(message: string, options: LocalStateError.Options = {}) {
    super(message, { cause: options.sourceError });
    this.name = "LocalStateError";
    this.path = options.path;

    brand(this);
    Object.setPrototypeOf(this, LocalStateError.prototype);
  }
}
