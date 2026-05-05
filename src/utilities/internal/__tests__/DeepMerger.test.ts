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

test("ignores __proto__ key to prevent prototype pollution", () => {
  const merger = new DeepMerger();
  const target = { a: 1 };
  // JSON.parse creates __proto__ as an own enumerable property
  const malicious = JSON.parse('{"__proto__": {"polluted": true}}');

  const result = merger.merge(target, malicious);

  expect((Object.prototype as any).polluted).toBeUndefined();
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(result).toEqual({ a: 1 });
});

test("ignores constructor key to prevent prototype pollution", () => {
  const merger = new DeepMerger();
  const target = { a: 1 };
  const malicious = JSON.parse('{"constructor": {"prototype": {"polluted": true}}}');

  const result = merger.merge(target, malicious);

  expect((Object.prototype as any).polluted).toBeUndefined();
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(result).toEqual({ a: 1 });
});

test("ignores __proto__ and constructor in atPath to prevent prototype pollution", () => {
  const merger = new DeepMerger();
  const target = { a: 1 };

  const resultProto = merger.merge(target, { polluted: true }, {
    atPath: ["__proto__"],
  });
  expect((Object.prototype as any).polluted).toBeUndefined();
  expect(Object.getPrototypeOf(resultProto)).toBe(Object.prototype);
  expect(resultProto).toEqual({ a: 1 });

  const resultCtor = merger.merge(target, { polluted: true }, {
    atPath: ["constructor"],
  });
  expect((Object.prototype as any).polluted).toBeUndefined();
  expect(Object.getPrototypeOf(resultCtor)).toBe(Object.prototype);
  expect(resultCtor).toEqual({ a: 1 });
});
