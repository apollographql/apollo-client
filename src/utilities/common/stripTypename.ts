import { omitDeep } from "@apollo/client/utilities/internal";

export function stripTypename<T>(value: T) {
  return omitDeep(value, "__typename");
}
