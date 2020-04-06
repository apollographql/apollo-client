// Make sure Map.prototype.set returns the Map instance, per spec.
// https://github.com/apollographql/apollo-client/issues/4024
const testMap = new Map();
if (testMap.set(1, 2) !== testMap) {
  const { set } = testMap;
  Map.prototype.set = function (...args) {
    set.apply(this, args);
    return this;
  };
}

// Make sure Set.prototype.add returns the Set instance, per spec.
const testSet = new Set();
if (testSet.add(3) !== testSet) {
  const { add } = testSet;
  Set.prototype.add = function (...args) {
    add.apply(this, args);
    return this;
  };
}

const frozen = {};
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
  testMap.set(frozen, frozen).delete(frozen);
} catch {
  const wrap = (method: <T>(obj: T) => T): typeof method => {
    return method && (obj => {
      try {
        // If .set succeeds, also call .delete to avoid leaking memory.
        testMap.set(obj, obj).delete(obj);
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

export {}
