import { compact } from "../compact";

const hasOwn = Object.prototype.hasOwnProperty;

describe("compact", () => {
  it("should produce an empty object when called without args", () => {
    expect(compact()).toEqual({});
  });

  it("should merge objects without modifying them", () => {
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

  it("should clean undefined values from single objects", () => {
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

  it("should skip over undefined values in later objects", () => {
    expect(
      compact({ a: 1, b: 2 }, { b: void 0, c: 3 }, { a: 4, c: void 0 })
    ).toEqual({
      a: 4,
      b: 2,
      c: 3,
    });
  });

  it("should not leave undefined properties in result object", () => {
    const result = compact({ a: 1, b: void 0 }, { a: 2, c: void 0 });
    expect(hasOwn.call(result, "a")).toBe(true);
    expect(hasOwn.call(result, "b")).toBe(false);
    expect(hasOwn.call(result, "c")).toBe(false);
    expect(result).toEqual({ a: 2 });
  });
});
