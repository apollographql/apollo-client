const { toString } = Object.prototype;

/**
 * Deeply clones a value to create a new instance.
 */
export function cloneDeep<T>(value: T): T {
  return cloneDeepHelper(value, new Map());
}

function cloneDeepHelper<T>(val: T, seen: Map<any, any>): T {
  switch (toString.call(val)) {
  case "[object Array]": {
    if (seen.has(val)) return seen.get(val);
    const copy: T & any[] = (val as any).slice(0);
    seen.set(val, copy);
    copy.forEach(function (child, i) {
      copy[i] = cloneDeepHelper(child, seen);
    });
    return copy;
  }

  case "[object Date]":
    return new Date(+val) as T & Date;

  case "[object Object]": {
    if (seen.has(val)) return seen.get(val);
    // High fidelity polyfills of Object.create and Object.getPrototypeOf are
    // possible in all JS environments, so we will assume they exist/work.
    const copy = Object.create(Object.getPrototypeOf(val));
    seen.set(val, copy);

    if (typeof Object.getOwnPropertyDescriptor === "function") {
      const handleKey = function (key: string | symbol) {
        const desc = Object.getOwnPropertyDescriptor(val, key);
        // If the property is backed by a getter function, this code turns it
        // into a simple value property, though other descriptor properties like
        // enumerable, writable, and configurable will be preserved.
        desc.value = cloneDeepHelper((val as any)[key], seen);
        if (desc.get) delete desc.get;
        if (desc.set) delete desc.set;
        Object.defineProperty(copy, key, desc);
      };
      Object.getOwnPropertyNames(val).forEach(handleKey);
      if (typeof Object.getOwnPropertySymbols === "function") {
        Object.getOwnPropertySymbols(val).forEach(handleKey);
      }
    } else {
      Object.keys(val).forEach(key => {
        copy[key] = cloneDeepHelper((val as any)[key], seen);
      });
    }

    return copy;
  }

  default:
    return val;
  }
}
