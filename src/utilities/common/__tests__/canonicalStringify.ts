import { canonicalStringify } from "../canonicalStringify";

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

  it("should not modify keys of custom-prototype objects", () => {
    class Custom {
      z = "z";
      y = "y";
      x = "x";
      b = "b";
      a = "a";
      c = "c";
    }

    const obj = {
      z: "z",
      x: "x",
      y: new Custom(),
    };

    expect(Object.keys(obj.y)).toEqual(["z", "y", "x", "b", "a", "c"]);

    expect(canonicalStringify(obj)).toBe(
      '{"x":"x","y":{"z":"z","y":"y","x":"x","b":"b","a":"a","c":"c"},"z":"z"}'
    );
  });
});
