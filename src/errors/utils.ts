export function isBranded(error: unknown, name: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as any)[Symbol.for("apollo.error")] === name
  );
}

export function brand(error: Error) {
  Object.defineProperty(error, Symbol.for("apollo.error"), {
    value: error.name,
    enumerable: false,
    writable: false,
    configurable: false,
  });
}
