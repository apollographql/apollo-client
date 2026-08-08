import { canonicalStringify } from "@apollo/client/utilities";

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

  // An own `__proto__` key comes from JSON, which is where variables restored
  // from a query string, from storage, or from a server response come from.
  // `JSON.parse` is used here rather than `allObjectPermutations`, which builds
  // its objects by assignment and so cannot carry the key either.
  it("should stringify an own __proto__ key the same way in every position", () => {
    const protoFirst = JSON.parse('{"__proto__":{"x":1},"b":2}');
    const protoLast = JSON.parse('{"b":2,"__proto__":{"x":1}}');

    // JSON.stringify keeps the key in both orders, so the two objects really
    // do hold the same data going in.
    expect(JSON.stringify(protoFirst)).toBe('{"__proto__":{"x":1},"b":2}');
    expect(JSON.stringify(protoLast)).toBe('{"b":2,"__proto__":{"x":1}}');

    expect(canonicalStringify(protoFirst)).toBe('{"__proto__":{"x":1},"b":2}');
    expect(canonicalStringify(protoLast)).toBe('{"__proto__":{"x":1},"b":2}');
  });

  it("should stringify an own __proto__ key on a nested object", () => {
    const obj = JSON.parse('{"z":"z","y":{"b":2,"__proto__":{"x":1}},"x":"x"}');

    expect(canonicalStringify(obj)).toBe(
      '{"x":"x","y":{"__proto__":{"x":1},"b":2},"z":"z"}'
    );
  });

  it("should not run the inherited __proto__ setter while sorting", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "__proto__"
    )!;
    let setterCalls = 0;

    Object.defineProperty(Object.prototype, "__proto__", {
      ...descriptor,
      set(this: unknown, value: unknown) {
        setterCalls++;
        descriptor.set!.call(this, value);
      },
    });

    try {
      canonicalStringify(JSON.parse('{"b":2,"__proto__":{"x":1}}'));
    } finally {
      Object.defineProperty(Object.prototype, "__proto__", descriptor);
    }

    expect(setterCalls).toBe(0);
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
