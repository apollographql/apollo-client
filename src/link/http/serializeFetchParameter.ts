import { newInvariantError } from "@apollo/client/utilities/globals";
import type { InvariantError } from "@apollo/client/utilities/globals";

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
