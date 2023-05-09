import { DeepOmit } from '../types/DeepOmit';
import { isPlainObject } from './objects';

const BREAK: unique symbol = Symbol('BREAK');

export interface OmitDeepOptions {
  keep?: (path: (string | number)[]) => boolean | typeof BREAK | undefined;
}

export function omitDeep<T, K extends string>(
  value: T,
  key: K,
  options: OmitDeepOptions = Object.create(null)
) {
  return __omitDeep(value, key, options);
}

omitDeep.BREAK = BREAK;

function __omitDeep<T, K extends string>(
  value: T,
  key: K,
  options: OmitDeepOptions,
  known = new Map<any, any>(),
  path = [] as (string | number)[]
): DeepOmit<T, K> {
  if (known.has(value)) {
    return known.get(value);
  }

  let modified = false;

  if (Array.isArray(value)) {
    const array: any[] = [];
    known.set(value, array);

    value.forEach((value, index) => {
      const objectPath = path.concat(index);
      const result =
        options.keep?.(objectPath) === BREAK
          ? value
          : __omitDeep(value, key, options, known, objectPath);
      modified ||= result !== value;

      array[index] = result;
    });

    if (modified) {
      return array as DeepOmit<T, K>;
    }
  } else if (isPlainObject(value)) {
    const obj = Object.create(Object.getPrototypeOf(value));
    known.set(value, obj);

    Object.keys(value).forEach((k) => {
      const objectPath = path.concat(k);
      const keep = options.keep?.(objectPath);

      if (k === key && keep !== true) {
        modified = true;
        return;
      }

      const result =
        keep === BREAK
          ? value[k]
          : __omitDeep(value[k], key, options, known, objectPath);

      modified ||= result !== value[k];

      obj[k] = result;
    });

    if (modified) {
      return obj;
    }
  }

  return value as DeepOmit<T, K>;
}
