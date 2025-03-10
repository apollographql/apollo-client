export class UnconventionalError extends Error {
  constructor(errorType: unknown) {
    super("An error of unexpected shape occurred.", { cause: errorType });
    this.name = "UnconventionalError";

    Object.setPrototypeOf(this, UnconventionalError.prototype);
  }
}
