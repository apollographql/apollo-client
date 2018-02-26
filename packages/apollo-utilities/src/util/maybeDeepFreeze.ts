import { isDevelopment, isTest } from './environment';

// taken straight from https://github.com/substack/deep-freeze to avoid import hassles with rollup
function deepFreeze(o: any) {
  Object.freeze(o);

  Object.getOwnPropertyNames(o).forEach(function(prop) {
    if (
      o.hasOwnProperty(prop) &&
      o[prop] !== null &&
      (typeof o[prop] === 'object' || typeof o[prop] === 'function') &&
      !Object.isFrozen(o[prop])
    ) {
      deepFreeze(o[prop]);
    }
  });

  return o;
}

export function maybeDeepFreeze(obj: any) {
  // Polyfilled Symbols potentially cause infinite / very deep recursion while deep freezing
  // which is known to crash IE11 (https://github.com/apollographql/apollo-client/issues/3043).
  const symbolIsPolyfilled =
    typeof Symbol === 'function' && typeof Symbol('') === 'string';

  if ((isDevelopment() || isTest()) && !symbolIsPolyfilled) {
    return deepFreeze(obj);
  }
  return obj;
}
