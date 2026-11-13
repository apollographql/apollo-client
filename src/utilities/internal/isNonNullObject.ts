/** @internal */
export function isNonNullObject(
  obj: unknown
): obj is Record<string | number | symbol, any> {
  return obj !== null && typeof obj === "object";
}
