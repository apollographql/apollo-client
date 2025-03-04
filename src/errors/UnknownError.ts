export class UnknownError extends Error {
  constructor(errorType: unknown) {
    // @ts-expect-error Need to upgrade ts lib
    super("An error of unknown type occurred", { cause: errorType });
    this.name = "UnknownError";
  }
}
