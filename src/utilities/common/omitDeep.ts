import { DeepOmit } from '../types/DeepOmit';
import { isNonNullObject } from './objects';

export function omitDeep<T, K extends string>(obj: T, key: K): DeepOmit<T, K> {
  if (Array.isArray(obj)) {
    return obj.map((value) => omitDeep(value, key)) as DeepOmit<T, K>;
  }

  if (isNonNullObject(obj)) {
    return Object.entries(obj).reduce((memo, [k, value]) => {
      if (k === key) {
        return memo;
      }

      return { ...memo, [k]: omitDeep(value, key) };
    }, {}) as DeepOmit<T, K>;
  }

  return obj as DeepOmit<T, K>;
}
