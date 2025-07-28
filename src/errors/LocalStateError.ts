import { brand, isBranded } from "./utils.js";

export declare namespace LocalStateError {
  export interface Options {
    path?: Array<string | number>;
    sourceError?: unknown;
  }

  namespace DocumentationTypes {
    interface InstanceProperties {
      /** The path to the field that caused the error. */
      readonly path?: Array<string | number>;
    }
  }
}

/**
 * Represents a fatal error when executing `@client` fields from `LocalState`,
 * typically to indicate a problem with the `LocalState` configuration or
 * incorrect usage of a resolver function. This error does not represent user
 * errors thrown in a local resolver when resolving `@client` fields.
 *
 * @example
 *
 * ```ts
 * import { LocalStateError } from "@apollo/client/errors";
 *
 * // Check if an error is a LocalStateError instance
 * if (LocalStateError.is(error)) {
 *   console.log("Original error:", error.cause);
 *
 *   // Determine which field caused the error
 *   if (error.path) {
 *     console.log("Error occurred at field path:", error.path.join("."));
 *   }
 * }
 * ```
 */
export class LocalStateError extends Error {
  /**
   * A method that determines whether an error is a `LocalStateError`
   * object. This method enables TypeScript to narrow the error type.
   *
   * @example
   *
   * ```ts
   * if (LocalStateError.is(error)) {
   *   // TypeScript now knows `error` is a LocalStateError object
   *   console.log(error.path);
   * }
   * ```
   */
  static is(error: unknown): error is LocalStateError {
    return isBranded(error, "LocalStateError");
  }

  /** {@inheritDoc @apollo/client!LocalStateError.DocumentationTypes.InstanceProperties#path:member} */
  readonly path?: Array<string | number>;

  constructor(message: string, options: LocalStateError.Options = {}) {
    super(message, { cause: options.sourceError });
    this.name = "LocalStateError";
    this.path = options.path;

    brand(this);
    Object.setPrototypeOf(this, LocalStateError.prototype);
  }
}
