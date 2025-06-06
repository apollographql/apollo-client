import { omitDeep } from "@apollo/client/utilities/internal";

/**
 * Deeply removes all `__typename` properties in the given object or array.
 *
 * @param value - The object or array that should have `__typename` removed.
 * @returns The object with all `__typename` properties removed.
 */
export function stripTypename<T>(value: T) {
  return omitDeep(value, "__typename");
}
