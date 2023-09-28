import { canonicalStringify, lookupSortedKeys } from "../canonicalStringify";

function forEachPermutation(
  keys: string[],
  callback: (permutation: string[]) => void
) {
  if (keys.length <= 1) {
    callback(keys);
    return;
  }
  const first = keys[0];
  const rest = keys.slice(1);
  forEachPermutation(rest, (permutation) => {
    for (let i = 0; i <= permutation.length; ++i) {
      callback([...permutation.slice(0, i), first, ...permutation.slice(i)]);
    }
  });
}

function allObjectPermutations<T extends Record<string, any>>(obj: T) {
  const keys = Object.keys(obj);
  const permutations: T[] = [];
  forEachPermutation(keys, (permutation) => {
    const permutationObj = Object.create(Object.getPrototypeOf(obj));
    permutation.forEach((key) => {
      permutationObj[key] = obj[key];
    });
    permutations.push(permutationObj);
  });
  return permutations;
}

describe("canonicalStringify", () => {
  beforeEach(() => {
    canonicalStringify.reset();
  });

  it("should not modify original object", () => {
    const obj = { c: 3, a: 1, b: 2 };
    expect(canonicalStringify(obj)).toBe('{"a":1,"b":2,"c":3}');
    expect(Object.keys(obj)).toEqual(["c", "a", "b"]);
  });

  it("forEachPermutation should work", () => {
    const permutations: string[][] = [];
    forEachPermutation(["a", "b", "c"], (permutation) => {
      permutations.push(permutation);
    });
    expect(permutations).toEqual([
      ["a", "b", "c"],
      ["b", "a", "c"],
      ["b", "c", "a"],
      ["a", "c", "b"],
      ["c", "a", "b"],
      ["c", "b", "a"],
    ]);
  });

  it("canonicalStringify should stably stringify all permutations of an object", () => {
    const unstableStrings = new Set<string>();
    const stableStrings = new Set<string>();

    allObjectPermutations({
      c: 3,
      a: 1,
      b: 2,
    }).forEach((obj) => {
      unstableStrings.add(JSON.stringify(obj));
      stableStrings.add(canonicalStringify(obj));

      expect(canonicalStringify(obj)).toBe('{"a":1,"b":2,"c":3}');

      allObjectPermutations({
        z: "z",
        y: ["y", obj, "why"],
        x: "x",
      }).forEach((parent) => {
        expect(canonicalStringify(parent)).toBe(
          '{"x":"x","y":["y",{"a":1,"b":2,"c":3},"why"],"z":"z"}'
        );
      });
    });

    expect(unstableStrings.size).toBe(6);
    expect(stableStrings.size).toBe(1);
  });

  it("lookupSortedKeys(keys, false) should reuse same sorted array for all permutations", () => {
    const keys = ["z", "a", "c", "b"];
    const sorted = lookupSortedKeys(["z", "a", "b", "c"], false);
    expect(sorted).toEqual(["a", "b", "c", "z"]);
    forEachPermutation(keys, (permutation) => {
      expect(lookupSortedKeys(permutation, false)).toBe(sorted);
    });
  });

  it("lookupSortedKeys(keys, true) should return same array if already sorted", () => {
    const keys = ["a", "b", "c", "x", "y", "z"].sort();
    const sorted = lookupSortedKeys(keys, true);
    expect(sorted).toBe(keys);

    forEachPermutation(keys, (permutation) => {
      const sortedTrue = lookupSortedKeys(permutation, true);
      const sortedFalse = lookupSortedKeys(permutation, false);

      expect(sortedTrue).toEqual(sorted);
      expect(sortedFalse).toEqual(sorted);

      const wasPermutationSorted = permutation.every(
        (key, i) => key === keys[i]
      );

      if (wasPermutationSorted) {
        expect(sortedTrue).toBe(permutation);
        expect(sortedTrue).not.toBe(sorted);
      } else {
        expect(sortedTrue).not.toBe(permutation);
        expect(sortedTrue).toBe(sorted);
      }

      expect(sortedFalse).not.toBe(permutation);
      expect(sortedFalse).toBe(sorted);
    });
  });
});
