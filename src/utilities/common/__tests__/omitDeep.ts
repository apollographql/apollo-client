import { omitDeep } from "../omitDeep";

test("omits the key from a shallow object", () => {
  expect(omitDeep({ omit: "a", keep: "b", other: "c" }, "omit")).toEqual({
    keep: "b",
    other: "c",
  });
});

test("omits the key from arbitrarily nested object", () => {
  expect(
    omitDeep(
      {
        omit: "a",
        keep: {
          omit: "a",
          keep: "b",
          other: { omit: "a", keep: "b", other: "c" },
        },
      },
      "omit"
    )
  ).toEqual({
    keep: {
      keep: "b",
      other: { keep: "b", other: "c" },
    },
  });
});

test("omits the key from arrays", () => {
  expect(
    omitDeep(
      [
        { omit: "a", keep: "b", other: "c" },
        { omit: "a", keep: "b", other: "c" },
      ],
      "omit"
    )
  ).toEqual([
    { keep: "b", other: "c" },
    { keep: "b", other: "c" },
  ]);
});

test("omits the key from arbitrarily nested arrays", () => {
  expect(
    omitDeep(
      [
        [{ omit: "a", keep: "b", other: "c" }],
        [
          { omit: "a", keep: "b", other: "c" },
          [{ omit: "a", keep: "b", other: "c" }],
        ],
      ],
      "omit"
    )
  ).toEqual([
    [{ keep: "b", other: "c" }],
    [{ keep: "b", other: "c" }, [{ keep: "b", other: "c" }]],
  ]);
});

test("returns primitives unchanged", () => {
  expect(omitDeep("a", "ignored")).toBe("a");
  expect(omitDeep(1, "ignored")).toBe(1);
  expect(omitDeep(true, "ignored")).toBe(true);
  expect(omitDeep(null, "ignored")).toBe(null);
  expect(omitDeep(undefined, "ignored")).toBe(undefined);
  expect(omitDeep(Symbol.for("foo"), "ignored")).toBe(Symbol.for("foo"));
});

test("handles circular references", () => {
  let b: any;
  const a = { omit: "foo", b };
  b = { a, omit: "foo" };
  a.b = b;

  const variables = { a, b, omit: "foo" };

  const result = omitDeep(variables, "omit");

  expect(result).not.toHaveProperty("omit");
  expect(result.a).not.toHaveProperty("omit");
  expect(result.b).not.toHaveProperty("omit");
});

test("returns same object unmodified if key is not found", () => {
  const obj = {
    a: "a",
    b: "b",
    c: { d: "d", e: "e" },
  };

  const arr = [{ a: "a", b: "b", c: "c" }, { foo: "bar" }];

  expect(omitDeep(obj, "omit")).toBe(obj);
  expect(omitDeep(arr, "omit")).toBe(arr);
});

test("returns unmodified subtrees for subtrees that do not contain the key", () => {
  const original = {
    a: "a",
    foo: { bar: "true" },
    baz: [{ foo: "bar" }],
    omitOne: [{ foo: "bar", omit: true }, { foo: "bar" }],
  };

  const result = omitDeep(original, "omit");

  expect(result).not.toBe(original);
  expect(result.foo).toBe(original.foo);
  expect(result.baz).toBe(original.baz);
  expect(result.omitOne).not.toBe(original.omitOne);
  expect(result.omitOne[0]).not.toBe(original.omitOne[0]);
  expect(result.omitOne[1]).toBe(original.omitOne[1]);
});

test("only considers plain objects and ignores class instances when omitting properties", () => {
  class Thing {
    foo = "bar";
    omit = false;
  }

  const thing = new Thing();
  const original = { thing };

  const result = omitDeep(original, "omit");

  expect(result.thing).toBe(thing);
  expect(result.thing).toHaveProperty("omit", false);

  const modifiedThing = omitDeep(thing, "omit");

  expect(modifiedThing).toBe(thing);
  expect(modifiedThing).toHaveProperty("omit", false);
});
