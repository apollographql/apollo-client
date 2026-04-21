import { compact } from "@apollo/client/utilities/internal";

const hasOwn = Object.prototype.hasOwnProperty;

test("should produce an empty object when called without args", () => {
  expect(compact()).toEqual({});
});

test("should merge objects without modifying them", () => {
  const a = { a: 1, ay: "a" };
  const b = { b: 2, bee: "b" };
  const c = compact(a, b);

  expect(c).toEqual({
    ...a,
    ...b,
  });

  expect(Object.keys(a)).toEqual(["a", "ay"]);
  expect(Object.keys(b)).toEqual(["b", "bee"]);
});

test("should clean undefined values from single objects", () => {
  const source = {
    zero: 0,
    undef: void 0,
    three: 3,
  };

  const result = compact(source);

  expect(result).toEqual({
    zero: 0,
    three: 3,
  });

  expect(Object.keys(result)).toEqual(["zero", "three"]);
});

test("should skip over undefined values in later objects", () => {
  expect(
    compact({ a: 1, b: 2 }, { b: void 0, c: 3 }, { a: 4, c: void 0 })
  ).toEqual({
    a: 4,
    b: 2,
    c: 3,
  });
});

test("should not leave undefined properties in result object", () => {
  const result = compact({ a: 1, b: void 0 }, { a: 2, c: void 0 });
  expect(hasOwn.call(result, "a")).toBe(true);
  expect(hasOwn.call(result, "b")).toBe(false);
  expect(hasOwn.call(result, "c")).toBe(false);
  expect(result).toEqual({ a: 2 });
});

test("should preserve symbol options", () => {
  const symA = Symbol("a");
  const symB = Symbol("b");

  const result = compact(
    {
      [symA]: 123,
      [symB]: 456,
      foo: "bar",
    },
    {
      [symA]: 789,
      baz: "qux",
    },
    {
      [symA]: void 0,
      byd: "tbd",
    }
  );
  expect(result).toStrictEqualTyped({
    [symA]: 789,
    [symB]: 456,
    foo: "bar",
    baz: "qux",
    byd: "tbd",
  });
});
