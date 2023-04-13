import { omitDeep } from './omitDeep';

export function stripTypename<T>(value: T) {
  return omitDeep(value, '__typename');
}
