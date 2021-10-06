import { collectSpecifierPaths, extractKeyPath, getSpecifierPaths } from "../key-extractor";
import { KeySpecifier } from "../policies";

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

    check(["a", "b", "c"], [
      ["a"],
      ["b"],
      ["c"]
    ]);

    check(["a", ["b", "c"], "d"], [
      ["a", "b"],
      ["a", "c"],
      ["d"],
    ]);

    check(["a", "b", ["c"], "d"], [
      ["a"],
      ["b", "c"],
      ["d"],
    ]);

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
      return collectSpecifierPaths(
        specifier,
        path => extractKeyPath(object, path, null)
      );
    }

    function check(
      specifier: KeySpecifier,
      expected: Record<string, any>,
    ) {
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
      b: { d: { e: 456 }}
    });

    check(["b", ["d", ["e"]], "a"], {
      b: { d: { e: 456 }},
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
});
