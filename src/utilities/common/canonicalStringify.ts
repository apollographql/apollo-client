import {
  AutoCleanedStrongCache,
  cacheSizes,
  defaultCacheSizes,
} from "../../utilities/caching/index.js";
import { registerGlobalCache } from "../caching/getMemoryInternals.js";

/**
 * Like JSON.stringify, but with object keys always sorted in the same order.
 *
 * To achieve performant sorting, this function uses a Map from JSON-serialized
 * arrays of keys (in any order) to sorted arrays of the same keys, with a
 * single sorted array reference shared by all permutations of the keys.
 *
 * As a drawback, this function will add a little bit more memory for every
 * object encountered that has different (more, less, a different order of) keys
 * than in the past.
 *
 * In a typical application, this extra memory usage should not play a
 * significant role, as `canonicalStringify` will be called for only a limited
 * number of object shapes, and the cache will not grow beyond a certain point.
 * But in some edge cases, this could be a problem, so we provide
 * canonicalStringify.reset() as a way of clearing the cache.
 * */
export const canonicalStringify = Object.assign(
  function canonicalStringify(value: any): string {
    return JSON.stringify(value, stableObjectReplacer);
  },
  {
    reset() {
      // Clearing the sortingMap will reclaim all cached memory, without
      // affecting the logical results of canonicalStringify, but potentially
      // sacrificing performance until the cache is refilled.
      sortingMap = new AutoCleanedStrongCache<string, readonly string[]>(
        cacheSizes.canonicalStringify || defaultCacheSizes.canonicalStringify
      );
    },
  }
);

if (__DEV__) {
  registerGlobalCache("canonicalStringify", () => sortingMap.size);
}

// Values are JSON-serialized arrays of object keys (in any order), and values
// are sorted arrays of the same keys.
let sortingMap!: AutoCleanedStrongCache<string, readonly string[]>;
canonicalStringify.reset();

// The JSON.stringify function takes an optional second argument called a
// replacer function. This function is called for each key-value pair in the
// object being stringified, and its return value is used instead of the
// original value. If the replacer function returns a new value, that value is
// stringified as JSON instead of the original value of the property.
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#the_replacer_parameter
function stableObjectReplacer(key: string, value: any) {
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    // We don't want to mess with objects that are not "plain" objects, which
    // means their prototype is either Object.prototype or null. This check also
    // prevents needlessly rearranging the indices of arrays.
    if (proto === Object.prototype || proto === null) {
      const keys = Object.keys(value);
      // If keys is already sorted, let JSON.stringify serialize the original
      // value instead of creating a new object with keys in the same order.
      if (keys.every(everyKeyInOrder)) return value;
      const unsortedKey = JSON.stringify(keys);
      let sortedKeys = sortingMap.get(unsortedKey);
      if (!sortedKeys) {
        keys.sort();
        const sortedKey = JSON.stringify(keys);
        // Checking for sortedKey in the sortingMap allows us to share the same
        // sorted array reference for all permutations of the same set of keys.
        sortedKeys = sortingMap.get(sortedKey) || keys;
        sortingMap.set(unsortedKey, sortedKeys);
        sortingMap.set(sortedKey, sortedKeys);
      }
      const sortedObject = Object.create(proto);
      // Reassigning the keys in sorted order will cause JSON.stringify to
      // serialize them in sorted order.
      sortedKeys.forEach((key) => {
        sortedObject[key] = value[key];
      });
      return sortedObject;
    }
  }
  return value;
}

// Since everything that happens in stableObjectReplacer benefits from being as
// efficient as possible, we use a static function as the callback for
// keys.every in order to test if the provided keys are already sorted without
// allocating extra memory for a callback.
function everyKeyInOrder(
  key: string,
  i: number,
  keys: readonly string[]
): boolean {
  return i === 0 || keys[i - 1] <= key;
}
