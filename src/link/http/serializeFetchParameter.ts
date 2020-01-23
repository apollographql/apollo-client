import { InvariantError } from 'ts-invariant';

export type ClientParseError = InvariantError & {
  parseError: Error;
};

export const serializeFetchParameter = (p: any, label: string) => {
  let serialized;
  try {
    serialized = JSON.stringify(p);
  } catch (e) {
    const parseError = new InvariantError(
      `Network request failed. ${label} is not serializable: ${e.message}`,
    ) as ClientParseError;
    parseError.parseError = e;
    throw parseError;
  }
  return serialized;
};
