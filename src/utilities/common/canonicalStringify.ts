/**
 * Like JSON.stringify, but with object keys always sorted in the same order.
 *
 * To achieve performant sorting, this function uses a trie to store the sorted
 * key names of objects that have already been encountered, bringing "memoized"
 * sort actions down to O(n) from O(n log n).
 *
 * As a drawback, this function will add a little bit more memory for every object
 * is called with that has different (more, less, a different order) keys than
 * in the past.
 *
 * In a typical application, this should not play a significant role, as
 * `canonicalStringify` will be called for only a limited number of object shapes,
 * and the cache will not grow beyond a certain point.
 * But in some edge cases, this could be a problem, so we provide a `reset` method
 * that will clear the cache and could be called at intervals from userland.
 * */
export const canonicalStringify = Object.assign(
  function canonicalStringify(value: any): string {
    return JSON.stringify(value, stableObjectReplacer);
  },
  {
    reset() {
      // Blowing away the root-level trie map will reclaim all memory stored in
      // the trie, without affecting the logical results of canonicalStringify,
      // but potentially sacrificing performance until the trie is refilled.
      sortingTrieRoot.clear();
    },
  }
);

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
    // means their prototype is either Object.prototype or null.
    if (proto === Object.prototype || proto === null) {
      const keys = Object.keys(value);
      const sortedKeys = lookupSortedKeys(keys, true);
      if (sortedKeys !== keys) {
        const sorted = Object.create(null);
        // Reassigning the keys in sorted order will cause JSON.stringify to
        // serialize them in sorted order.
        sortedKeys.forEach((key) => {
          sorted[key] = value[key];
        });
        return sorted;
      }
    }
  }
  return value;
}

type SortingTrie = Map<string, SortingTrie> & {
  // If there is an entry in the trie for the sequence of keys leading up to
  // this node, the node.sorted array will contain those keys in sorted order.
  // The contents of the Map represent the next level(s) of the trie, branching
  // out for each possible next key.
  sorted?: readonly string[];
}

const sortingTrieRoot: SortingTrie = new Map;

// Sort the given keys using a lookup trie, with an option to return the same
// (===) array in case it was already sorted, so we can avoid always creating a
// new object in the replacer function above.
function lookupSortedKeys(
  keys: readonly string[],
  returnKeysIfAlreadySorted: boolean,
): readonly string[] {
  let node = sortingTrieRoot;
  let alreadySorted = true;
  for (let k = 0, len = keys.length; k < len; ++k) {
    const key = keys[k];
    if (k > 0 && keys[k - 1] > key) {
      alreadySorted = false;
    }
    node = node.get(key) || node.set(key, new Map).get(key)!;
  }

  if (alreadySorted) {
    return node.sorted
      // There may already be a node.sorted array that's equivalent to the
      // already-sorted keys array, but if keys was already sorted, we want to
      // return the keys reference as-is when returnKeysIfAlreadySorted is true.
      // This behavior helps us decide whether we need to create a new object in
      // the stableObjectReplacer function above.
      ? (returnKeysIfAlreadySorted ? keys : node.sorted)
      : (node.sorted = keys);
  }

  // To conserve the total number of sorted arrays we store in the trie, we
  // always use the same sorted array reference for a given set of strings,
  // regardless of which permutation of the strings led to this SortingTrie
  // node. To obtain this one true array, we do a little extra work to look up
  // the sorted array associated with the sorted permutation, since there will
  // be one unique path through the trie for the sorted permutation (even if
  // there were duplicate keys). We can reuse the lookupSortedKeys function to
  // perform this lookup, but we pass false for returnKeysIfAlreadySorted so it
  // will return the existing array (if any) rather than the new sorted array we
  // use to perform the lookup. If there is no existing array associated with
  // the sorted permutation, the new array produced by keys.slice(0).sort() will
  // be stored as the one true array and returned here. Since we are passing in
  // an array that is definitely already sorted, this call to lookupSortedKeys
  // will never actually have to call .sort(), so this lookup is always linear.
  return node.sorted || (
    node.sorted = lookupSortedKeys(keys.slice(0).sort(), false)
  );
}
