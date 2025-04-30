/** @internal */
export function isPlainObject(
  obj: unknown
): obj is Record<string | number, any> {
  return (
    obj !== null &&
    typeof obj === "object" &&
    (Object.getPrototypeOf(obj) === Object.prototype ||
      Object.getPrototypeOf(obj) === null)
  );
}
