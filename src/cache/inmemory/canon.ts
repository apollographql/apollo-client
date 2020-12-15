import { KeyTrie } from "optimism";
import { canUseWeakMap } from "../../utilities";
import { objToStr } from "./helpers";

class Pass<T> {
  constructor(public readonly value: T) {}
}

// When we say an object is "canonical" in programming, we mean it has been
// admitted into some abstract "canon" of official/blessed objects. This
// Canon class is a representation of such a collection, with the property
// that canon.admit(value1) === canon.admit(value2) if value1 and value2 are
// deeply equal to each other. The canonicalization process involves looking
// at every property in the provided object tree, so it takes the same order
// of time as deep equality checking (linear time), but already-admitted
// objects are returned immediately from canon.admit, so ensuring subtrees
// have already been canonized tends to speed up canonicalization. Of
// course, since canonized objects may be shared widely between unrelated
// consumers, it's important to regard them as immutable. No detection of
// cycles is needed by the StoreReader class right now, so we don't bother
// keeping track of objects we've already seen during the recursion of the
// admit method. Objects whose internal class name is neither Array nor
// Object can be included in the value tree, but they will not be replaced
// with a canonical version (to put it another way, they are assumed to be
// canonical already). We can easily add additional cases to the switch
// statement to handle other common object types, such as "[object Date]"
// objects, as needed.
export class Canon {
  // All known objects this Canon has admitted.
  private known = new (canUseWeakMap ? WeakSet : Set)<object>();

  // Efficient storage/lookup structure for admitting objects.
  private pool = new KeyTrie<{
    array?: any[];
    object?: Record<string, any>;
    keys?: SortedKeysInfo;
  }>(canUseWeakMap);

  // Make the ObjectCanon assume this value has already been
  // canonicalized.
  public pass<T>(value: T): Pass<T>;
  public pass(value: any) {
    return new Pass(value);
  }

  // Returns the canonical version of value.
  public admit<T>(value: T): T;
  public admit(value: any) {
    if (value && typeof value === "object") {
      if (value instanceof Pass) {
        return value.value;
      }

      switch (objToStr.call(value)) {
        case "[object Array]": {
          if (this.known.has(value)) return value;
          const array: any[] = value.map(this.admit, this);
          // Arrays are looked up in the KeyTrie using their recursively
          // canonicalized elements, and the known version of the array is
          // preserved as node.array.
          const node = this.pool.lookupArray(array);
          if (!node.array) {
            this.known.add(node.array = array);
            if (process.env.NODE_ENV !== "production") {
              Object.freeze(array);
            }
          }
          return node.array;
        }

        case "[object Object]": {
          if (this.known.has(value)) return value;
          const proto = Object.getPrototypeOf(value);
          const array = [proto];
          const keys = this.sortedKeys(value);
          array.push(keys.json);
          keys.sorted.forEach(key => {
            array.push(this.admit(value[key]));
          });
          // Objects are looked up in the KeyTrie by their prototype
          // (which is *not* recursively canonicalized), followed by a
          // JSON representation of their (sorted) keys, followed by the
          // sequence of recursively canonicalized values corresponding to
          // those keys. To keep the final results unambiguous with other
          // sequences (such as arrays that just happen to contain [proto,
          // keys.json, value1, value2, ...]), the known version of the
          // object is stored as node.object.
          const node = this.pool.lookupArray(array);
          if (!node.object) {
            const obj = node.object = Object.create(proto);
            this.known.add(obj);
            keys.sorted.forEach((key, i) => {
              obj[key] = array[i + 2];
            });
            if (process.env.NODE_ENV !== "production") {
              Object.freeze(obj);
            }
          }
          return node.object;
        }
      }
    }
    return value;
  }

  // It's worthwhile to cache the sorting of arrays of strings, since the
  // same initial unsorted arrays tend to be encountered many times.
  // Fortunately, we can reuse the KeyTrie machinery to look up the sorted
  // arrays in linear time (which is faster than sorting large arrays).
  private sortedKeys(obj: object) {
    const keys = Object.keys(obj);
    const node = this.pool.lookupArray(keys);
    if (!node.keys) {
      keys.sort();
      const json = JSON.stringify(keys);
      if (!(node.keys = this.keysByJSON.get(json))) {
        this.keysByJSON.set(json, node.keys = { sorted: keys, json });
      }
    }
    return node.keys;
  }
  // Arrays that contain the same elements in a different order can share
  // the same SortedKeysInfo object, to save memory.
  private keysByJSON = new Map<string, SortedKeysInfo>();
}

type SortedKeysInfo = {
  sorted: string[];
  json: string;
};
