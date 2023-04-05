import { DeepOmit } from '../types/DeepOmit';
import { isNonNullObject } from './objects';

export function omitDeep<T, K extends string>(value: T, key: K) {
  return __omitDeep(value, key);
}

function __omitDeep<T, K extends string>(
  value: T,
  key: K,
  known = new Map<any, any>()
): DeepOmit<T, K> {
  if (known.has(value)) {
    return known.get(value);
  }

  if (Array.isArray(value)) {
    const array: any[] = [];
    known.set(value, array);

    value.forEach((value, index) => {
      array[index] = __omitDeep(value, key, known);
    });

    return array as DeepOmit<T, K>;
  }

  if (isNonNullObject(value)) {
    const obj = Object.create(Object.getPrototypeOf(value));
    known.set(value, obj);

    Object.keys(value).forEach((k) => {
      if (k !== key) {
        obj[k] = __omitDeep(value[k], key, known);
      }
    });

    return obj;
  }

  return value as DeepOmit<T, K>;
}
