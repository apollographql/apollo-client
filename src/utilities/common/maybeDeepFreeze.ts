import { isDevelopment, isTest } from './environment';
import { isNonNullObject } from './objects';

function deepFreeze(value: any) {
  const workSet = new Set([value]);
  workSet.forEach(obj => {
    if (isNonNullObject(obj)) {
      if (!Object.isFrozen(obj)) Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach(name => {
        if (isNonNullObject(obj[name])) workSet.add(obj[name]);
      });
    }
  });
  return value;
}

export function maybeDeepFreeze<T>(obj: T): T {
  if (process.env.NODE_ENV !== "production" && (isDevelopment() || isTest())) {
    deepFreeze(obj);
  }
  return obj;
}
