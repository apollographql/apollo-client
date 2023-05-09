import { omitDeep, OmitDeepOptions } from './omitDeep';

interface StripTypenameOptions {
  keep?: OmitDeepOptions['keep'];
}

export function stripTypename<T>(value: T, options?: StripTypenameOptions) {
  return omitDeep(value, '__typename', options);
}

stripTypename.BREAK = omitDeep.BREAK;
