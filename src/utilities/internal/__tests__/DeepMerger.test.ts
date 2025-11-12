import { DeepMerger } from "@apollo/client/utilities/internal";

test("supports custom reconciler functions", function () {
  const merger = new DeepMerger({
    reconciler(target, source, key) {
      const targetValue = target[key];
      const sourceValue = source[key];
      if (Array.isArray(sourceValue)) {
        if (!Array.isArray(targetValue)) {
          return sourceValue;
        }
        return [...targetValue, ...sourceValue];
      }
      return this.merge(targetValue, sourceValue);
    },
  });

  expect(
    merger.merge(
      {
        a: [1, 2, 3],
        b: "replace me",
      },
      {
        a: [4, 5],
        b: ["I", "win"],
      }
    )
  ).toEqual({
    a: [1, 2, 3, 4, 5],
    b: ["I", "win"],
  });
});

test("deep merges each array item keeping length by default", () => {
  const target = [{ a: 1, b: { c: 2 } }, { e: 5 }];
  const source = [{ a: 2, b: { c: 2, d: 3 } }];

  const result = new DeepMerger().merge(target, source);

  expect(result).toEqual([{ a: 2, b: { c: 2, d: 3 } }, { e: 5 }]);
});

test("deep merges each array item and truncates source to target length when using truncate arrayMerge", () => {
  const target = [{ a: 1, b: { c: 2 } }, { e: 5 }];
  const source = [{ a: 2, b: { c: 2, d: 3 } }];

  const result = new DeepMerger({
    arrayMerge: "truncate",
  }).merge(target, source);

  expect(result).toEqual([{ a: 2, b: { c: 2, d: 3 } }]);
});

test("maintains source length when using truncate arrayMerge when source is longer than target length", () => {
  const target = [{ a: 1, b: { c: 2 } }];
  const source = [{ a: 2 }, { e: 2 }];

  const result = new DeepMerger({
    arrayMerge: "truncate",
  }).merge(target, source);

  expect(result).toEqual([{ a: 2, b: { c: 2 } }, { e: 2 }]);
});
