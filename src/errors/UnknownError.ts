export class UnknownError extends Error {
  constructor(errorType: unknown) {
    super("An error of unknown type occurred", { cause: errorType });
    this.name = "UnknownError";

    Object.setPrototypeOf(this, UnknownError.prototype);
  }
}
