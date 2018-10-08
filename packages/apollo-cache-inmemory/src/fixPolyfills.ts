const frozen = {};
const frozenTestMap = new Map();

if (typeof Object.freeze === 'function') {
  Object.freeze(frozen);
}

try {
  // If non-extensible objects can't be stored as keys in a Map, make sure we
  // do not freeze/seal/etc. an object without first attempting to put it in a
  // Map. For example, this gives the React Native Map polyfill a chance to tag
  // objects before they become non-extensible:
  // https://github.com/facebook/react-native/blob/98a6f19d7c/Libraries/vendor/core/Map.js#L44-L50
  // https://github.com/apollographql/react-apollo/issues/2442#issuecomment-426489517
  frozenTestMap.set(frozen, frozen).delete(frozen);
} catch {
  const wrap = (method: <T>(obj: T) => T): typeof method => {
    return method && (obj => {
      try {
        // If .set succeeds, also call .delete to avoid leaking memory.
        frozenTestMap.set(obj, obj).delete(obj);
      } finally {
        // If .set or .delete fails, the exception will be silently swallowed
        // by this return-from-finally statement:
        return method.call(Object, obj);
      }
    });
  };
  Object.freeze = wrap(Object.freeze);
  Object.seal = wrap(Object.seal);
  Object.preventExtensions = wrap(Object.preventExtensions);
}
