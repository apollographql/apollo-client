export * from "./index.js";
// eslint-disable-next-line local-rules/import-from-export
import { maybeDeepFreeze } from "./index.js";

const testMap = new Map();
const polyFilled = (() => {
  try {
    const frozen = {};
    Object.freeze(frozen);
    // If non-extensible objects can't be stored as keys in a Map, make sure we
    // do not freeze/seal/etc. an object without first attempting to put it in a
    // Map. For example, this gives the React Native Map polyfill a chance to tag
    // objects before they become non-extensible:
    // https://github.com/facebook/react-native/blob/98a6f19d7c/Libraries/vendor/core/Map.js#L44-L50
    // https://github.com/apollographql/react-apollo/issues/2442#issuecomment-426489517
    testMap.set(frozen, frozen);
    testMap.delete(frozen);
  } catch {
    maybeDeepFreeze.freezeFn = (obj: any) => {
      try {
        // If .set succeeds, also call .delete to avoid leaking memory.
        testMap.set(obj, obj);
        testMap.delete(obj);
      } finally {
        // If .set or .delete fails, the exception will be silently swallowed
        // by this return-from-finally statement:
        return Object.freeze(obj);
      }
    };
  }

  return maybeDeepFreeze;
})();
export { polyFilled as maybeDeepFreeze };
