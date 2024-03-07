import { makeVar as orig_makeVar } from "../index.js";

export function makeVar<T>(value: T) {
  return orig_makeVar(value);
}
