import { newInvariantError } from "../../utilities/globals/index.js";
import type { InvariantError } from "../../utilities/globals/index.js";

export type ClientParseError = InvariantError & {
  parseError: Error;
};

export const serializeFetchParameter = (p: any, label: string) => {
  let serialized;
  try {
    serialized = JSON.stringify(p);
  } catch (e: any) {
    const parseError = newInvariantError(
      `Network request failed. %s is not serializable: %s`,
      label,
      e.message
    ) as ClientParseError;
    parseError.parseError = e;
    throw parseError;
  }
  return serialized;
};
