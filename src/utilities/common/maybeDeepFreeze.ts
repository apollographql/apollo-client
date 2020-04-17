import { isDevelopment, isTest } from './environment';

function isObject(value: any) {
  return value !== null && typeof value === "object";
}

function deepFreeze(value: any) {
  const workSet = new Set([value]);
  workSet.forEach(obj => {
    if (isObject(obj)) {
      if (!Object.isFrozen(obj)) Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach(name => {
        if (isObject(obj[name])) workSet.add(obj[name]);
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
