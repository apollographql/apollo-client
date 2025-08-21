const { toString } = Object.prototype;

/**
 * Deeply clones a value to create a new instance.
 *
 * @internal
 */
export function cloneDeep<T>(value: T): T {
  return __cloneDeep(value);
}

function __cloneDeep<T>(val: T, seen?: Map<any, any>): T {
  switch (toString.call(val)) {
    case "[object Array]": {
      seen = seen || new Map();
      if (seen.has(val)) return seen.get(val);
      const copy: T & any[] = (val as any).slice(0);
      seen.set(val, copy);
      copy.forEach(function (child, i) {
        copy[i] = __cloneDeep(child, seen);
      });
      return copy;
    }

    case "[object Object]": {
      seen = seen || new Map();
      if (seen.has(val)) return seen.get(val);
      // High fidelity polyfills of Object.create and Object.getPrototypeOf are
      // possible in all JS environments, so we will assume they exist/work.
      const copy = Object.create(Object.getPrototypeOf(val));
      seen.set(val, copy);
      Object.keys(val as T & Record<string, any>).forEach((key) => {
        copy[key] = __cloneDeep((val as any)[key], seen);
      });
      return copy;
    }

    default:
      return val;
  }
}
