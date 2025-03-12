/**
 * A wrapper error type that represents a non-standard error thrown from a
 * response, such as a symbol or plain object. Read the `cause` property to
 * determine the source of the error.
 */
export class UnconventionalError extends Error {
  constructor(errorType: unknown) {
    super("An error of unexpected shape occurred.", { cause: errorType });
    this.name = "UnconventionalError";

    Object.setPrototypeOf(this, UnconventionalError.prototype);
  }
}
