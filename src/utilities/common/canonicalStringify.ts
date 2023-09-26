// Like JSON.stringify, but with object keys always sorted in the same order.
export const canonicalStringify = Object.assign(
  function canonicalStringify(value: any): string {
    return JSON.stringify(value, stableObjectReplacer);
  },
  {
    reset() {
      // Blowing away the root-level trie map will reclaim all memory stored in
      // the trie, without affecting the logical results of canonicalStringify,
      // but potentially sacrificing performance until the trie is refilled.
      sortingTrieRoot.next = Object.create(null);
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
      const sortedKeys = sortKeys(keys);
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

interface SortingTrie {
  sorted?: readonly string[];
  next: Record<string, SortingTrie>;
}

const sortingTrieRoot: SortingTrie = {
  sorted: [],
  next: Object.create(null),
};

// Sort the given keys using a lookup trie, and return the same (===) array in
// case it was already sorted, so we can avoid always creating a new object in
// the replacer function above.
function sortKeys(keys: readonly string[]): readonly string[] {
  let node = sortingTrieRoot;
  let alreadySorted = true;
  for (let k = 0, len = keys.length; k < len; ++k) {
    const key = keys[k];
    if (k > 0 && keys[k - 1] > key) {
      alreadySorted = false;
    }
    const next = node.next;
    node = next[key] || (next[key] = { next: Object.create(null) });
  }
  if (alreadySorted) {
    // There may already be a node.sorted array that's equivalent to the
    // already-sorted keys array, but if keys was already sorted, we always want
    // to return that array, not node.sorted.
    return node.sorted ? keys : (node.sorted = keys);
  }
  // The .slice(0) is necessary so that we do not modify the original keys array
  // by calling keys.sort(), and also so that we always return a new (!==)
  // sorted array when keys was not already sorted.
  return node.sorted || (node.sorted = keys.slice(0).sort());
}
