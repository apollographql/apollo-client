import { omitDeep } from "./omitDeep.js";

export function stripTypename<T>(value: T) {
  return omitDeep(value, "__typename");
}
