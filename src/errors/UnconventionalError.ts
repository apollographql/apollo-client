import { brand, isBranded } from "./utils.js";

/**
 * A wrapper error type that represents a non-standard error thrown from a
 * A wrapper error type that represents a non-error value thrown from the
 * link chain, such as a symbol, primitive or plain object. Read the `cause` property to
 * determine the source of the error.
 *
 * @remarks
 *
 * This error is used to standardize error handling when non-Error values are
 * thrown in the Apollo Client link chain or other parts of the system.
 * JavaScript allows throwing any value (not just Error instances), and this
 * wrapper ensures that all thrown values can be handled consistently as
 * Error-like objects while preserving the original thrown value.
 *
 * > [!NOTE]
 * > Plain strings thrown as errors are wrapped in regular [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) objects instead of `UnconventionalError` objects since strings can be safely used as the error's `message`.
 *
 * @example
 *
 * ```ts
 * import { UnconventionalError } from "@apollo/client/errors";
 *
 * // Check if an error is an UnconventionalError instance
 * if (UnconventionalError.is(error)) {
 *   console.log("Non-standard error thrown:", error.cause);
 *
 *   // Check the type of the original thrown value
 *   if (typeof error.cause === "symbol") {
 *     console.log("A symbol was thrown:", error.cause.toString());
 *   } else if (typeof error.cause === "object") {
 *     console.log("An object was thrown:", error.cause);
 *   } else {
 *     console.log("Unexpected value thrown:", error.cause);
 *   }
 * }
 * ```
 */
export class UnconventionalError extends Error {
  /**
   * A method that determines whether an error is an `UnconventionalError`
   * object. This method enables TypeScript to narrow the error type.
   *
   * @example
   *
   * ```ts
   * if (UnconventionalError.is(error)) {
   *   // TypeScript now knows `error` is a UnconventionalError object
   *   console.log("What caused this?", error.cause);
   * }
   * ```
   */
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
