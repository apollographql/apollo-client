import { KeySpecifier } from "../policies";
import { canonicalStringify } from "../../../utilities";
import {
  getSpecifierPaths,
  collectSpecifierPaths,
  extractKeyPath,
} from "../key-extractor";

describe("keyFields and keyArgs extraction", () => {
  it("getSpecifierPaths should work for various specifiers", () => {
    function check(specifier: KeySpecifier, expected: string[][]) {
      const actualPaths = getSpecifierPaths(specifier);
      expect(actualPaths).toEqual(expected);
      // Make sure paths lookup is cached.
      expect(getSpecifierPaths(specifier)).toBe(actualPaths);
    }

    check([], []);
    check(["a"], [["a"]]);

    // prettier-ignore
    check(["a", "b", "c"], [
      ["a"],
      ["b"],
      ["c"]
    ]);

    // prettier-ignore
    check(["a", ["b", "c"], "d"], [
      ["a", "b"],
      ["a", "c"],
      ["d"],
    ]);

    // prettier-ignore
    check(["a", "b", ["c"], "d"], [
      ["a"],
      ["b", "c"],
      ["d"],
    ]);

    // prettier-ignore
    check(["a", "b", ["c", ["d", ["e", "f"], "g"]]], [
      ["a"],
      ["b", "c", "d", "e"],
      ["b", "c", "d", "f"],
      ["b", "c", "g"],
    ]);
  });

  it("collectSpecifierPaths should work for various specifiers", () => {
    const object = {
      a: 123,
      b: {
        d: {
          f: 567,
          e: 456,
        },
        c: 234,
        g: 678,
      },
      h: 789,
    };

    function collect(specifier: KeySpecifier) {
      return collectSpecifierPaths(specifier, (path) =>
        extractKeyPath(object, path)
      );
    }

    function check(specifier: KeySpecifier, expected: Record<string, any>) {
      const actual = collect(specifier);
      expect(actual).toEqual(expected);
      // Not only must actual and expected be equal, but their key orderings
      // must also be the same.
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    }

    check([], {});

    check(["a", "h"], {
      a: 123,
      h: 789,
    });

    check(["h", "a", "bogus"], {
      h: 789,
      a: 123,
    });

    check(["b", ["d", ["e"]]], {
      b: { d: { e: 456 } },
    });

    check(["b", ["d", ["e"]], "a"], {
      b: { d: { e: 456 } },
      a: 123,
    });

    check(["b", ["g", "d"], "a"], {
      b: {
        g: 678,
        d: {
          e: 456,
          f: 567,
        },
      },
      a: 123,
    });

    check(["b", "a"], {
      b: {
        // Notice that the keys of each nested object are sorted, despite being
        // out of order in the original object.
        c: 234,
        d: {
          e: 456,
          f: 567,
        },
        g: 678,
      },
      // This a key comes after the b key, however, because we requested that
      // ordering with the ["b", "a"] specifier array.
      a: 123,
    });
  });

  it("extractKeyPath can handle arrays", () => {
    const object = {
      extra: "read about it elsewhere",
      array: [
        { value: 1, a: "should be first" },
        { value: 2, x: "should come after value" },
        { z: "should come last", value: 3 },
      ],
      more: "another word for extra",
    };

    expect(extractKeyPath(object, ["array", "value"])).toEqual([1, 2, 3]);

    expect(
      collectSpecifierPaths(["array", ["value", "a", "x", "z"]], (path) => {
        expect(path.length).toBe(2);
        expect(path[0]).toBe("array");
        expect(["value", "a", "x", "z"]).toContain(path[1]);
        return extractKeyPath(object, path);
      })
    ).toEqual({
      array: {
        value: object.array.map((item) => item.value),
        a: ["should be first", void 0, void 0],
        x: [void 0, "should come after value", void 0],
        z: [void 0, void 0, "should come last"],
      },
    });

    // This test case is "underspecified" because the specifier array ["array"]
    // does not name any nested fields to pull from each array element.
    const underspecified = extractKeyPath(object, ["array"]);
    expect(underspecified).toEqual(object.array);
    const understringified = JSON.stringify(underspecified);
    // Although the objects are structurally equal, they do not stringify the
    // same, since the underspecified keys have been stably sorted.
    expect(understringified).not.toEqual(JSON.stringify(object.array));

    expect(understringified).toBe(
      JSON.stringify([
        // Note that a: object.array[0].a has become the first key, because "a"
        // precedes "value" alphabetically.
        { a: object.array[0].a, value: 1 },
        { value: 2, x: object.array[1].x },
        { value: 3, z: object.array[2].z },
      ])
    );

    // This new ordering also happens to be the canonical/stable ordering,
    // according to canonicalStringify.
    expect(understringified).toBe(canonicalStringify(object.array));
  });
});
