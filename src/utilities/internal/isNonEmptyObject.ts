import { isNonNullObject } from "./isNonNullObject.js";

/** @internal */
export function isNonEmptyObject<T extends object>(
  obj: T | undefined
): obj is T {
  return isNonNullObject(obj) && Object.keys(obj).length > 0;
}
