import { __DEV__ } from "@apollo/client/utilities/environment";

import { isNonNullObject } from "./objects.js";

/** @internal only to be imported in tests */
export function deepFreeze(value: any, freezeFn: (obj: any) => void) {
  const workSet = new Set([value]);
  workSet.forEach((obj) => {
    if (isNonNullObject(obj) && shallowFreeze(obj, freezeFn) === obj) {
      Object.getOwnPropertyNames(obj).forEach((name) => {
        if (isNonNullObject(obj[name])) workSet.add(obj[name]);
      });
    }
  });
  return value;
}

function shallowFreeze<T extends object>(
  obj: T,
  freezeFn: (obj: any) => void
): T | null {
  if (__DEV__ && !Object.isFrozen(obj)) {
    try {
      freezeFn(obj);
    } catch (e) {
      // Some types like Uint8Array and Node.js's Buffer cannot be frozen, but
      // they all throw a TypeError when you try, so we re-throw any exceptions
      // that are not TypeErrors, since that would be unexpected.
      if (e instanceof TypeError) return null;
      throw e;
    }
  }
  return obj;
}

export function maybeDeepFreeze<T>(obj: T): T {
  if (__DEV__) {
    deepFreeze(obj, maybeDeepFreeze.freezeFn);
  }
  return obj;
}
maybeDeepFreeze.freezeFn = Object.freeze.bind(Object);
