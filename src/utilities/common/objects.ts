export function isNonNullObject(obj: any): obj is Record<string | number, any> {
  return obj !== null && typeof obj === "object";
}

export function isPlainObject(obj: any): obj is Record<string | number, any> {
  return (
    obj !== null &&
    typeof obj === "object" &&
    (Object.getPrototypeOf(obj) === Object.prototype ||
      Object.getPrototypeOf(obj) === null)
  );
}
