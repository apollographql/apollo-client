import { mergeDeep } from "@apollo/client/utilities/internal";

test("should return an object if first argument falsy", function () {
  expect(mergeDeep()).toEqual({});
  expect(mergeDeep(null)).toEqual({});
  expect(mergeDeep(null, { foo: 42 })).toEqual({ foo: 42 });
});

test("should preserve identity for single arguments", function () {
  const arg = {};
  expect(mergeDeep(arg)).toBe(arg);
});

test("should preserve identity when merging non-conflicting objects", function () {
  const a = { a: { name: "ay" } };
  const b = { b: { name: "bee" } };
  const c = mergeDeep(a, b);
  expect(c.a).toBe(a.a);
  expect(c.b).toBe(b.b);
  expect(c).toEqual({
    a: { name: "ay" },
    b: { name: "bee" },
  });
});

test("should shallow-copy conflicting fields", function () {
  const a = { conflict: { fromA: [1, 2, 3] } };
  const b = { conflict: { fromB: [4, 5] } };
  const c = mergeDeep(a, b);
  expect(c.conflict).not.toBe(a.conflict);
  expect(c.conflict).not.toBe(b.conflict);
  expect(c.conflict.fromA).toBe(a.conflict.fromA);
  expect(c.conflict.fromB).toBe(b.conflict.fromB);
  expect(c).toEqual({
    conflict: {
      fromA: [1, 2, 3],
      fromB: [4, 5],
    },
  });
});

test("should resolve conflicts among more than two objects", function () {
  const sources = [];

  for (let i = 0; i < 100; ++i) {
    sources.push({
      ["unique" + i]: { value: i },
      conflict: {
        ["from" + i]: { value: i },
        nested: {
          ["nested" + i]: { value: i },
        },
      },
    });
  }

  const merged = mergeDeep(...sources);

  sources.forEach((source, i) => {
    expect(merged["unique" + i].value).toBe(i);
    expect(source["unique" + i]).toBe(merged["unique" + i]);

    expect(merged.conflict).not.toBe(source.conflict);
    expect(merged.conflict["from" + i].value).toBe(i);
    expect(merged.conflict["from" + i]).toBe(source.conflict["from" + i]);

    expect(merged.conflict.nested).not.toBe(source.conflict.nested);
    expect(merged.conflict.nested["nested" + i].value).toBe(i);
    expect(merged.conflict.nested["nested" + i]).toBe(
      source.conflict.nested["nested" + i]
    );
  });
});

test("can merge array elements", function () {
  const a = [{ a: 1 }, { a: "ay" }, "a"];
  const b = [{ b: 2 }, { b: "bee" }, "b"];
  const c = [{ c: 3 }, { c: "cee" }, "c"];
  const d = { 1: { d: "dee" } };

  expect(mergeDeep(a, b, c, d)).toEqual([
    { a: 1, b: 2, c: 3 },
    { a: "ay", b: "bee", c: "cee", d: "dee" },
    "c",
  ]);
});

test("lets the last conflicting value win", function () {
  expect(mergeDeep("a", "b", "c")).toBe("c");

  expect(
    mergeDeep(
      { a: "a", conflict: 1 },
      { b: "b", conflict: 2 },
      { c: "c", conflict: 3 }
    )
  ).toEqual({
    a: "a",
    b: "b",
    c: "c",
    conflict: 3,
  });

  // prettier-ignore
  expect(
      mergeDeep(
        ['a', ['b', 'c'], 'd'],
        [/*empty*/, ['B'], 'D'],
      )
    ).toEqual(
      ['a', ['B', 'c'], 'D'],
    );

  // prettier-ignore
  expect(
      mergeDeep(
        ['a', ['b', 'c'], 'd'],
        ['A', [/*empty*/, 'C']],
      )
    ).toEqual(
      ['A', ['b', 'C'], 'd'],
    );
});

test("mergeDeep returns the intersection of its argument types", function () {
  const abc = mergeDeep({ str: "hi", a: 1 }, { a: 3, b: 2 }, { b: 1, c: 2 });
  // The point of this test is that the following lines type-check without
  // resorting to any `any` loopholes:
  expect(abc.str.slice(0)).toBe("hi");
  expect(abc.a * 2).toBe(6);
  expect(abc.b - 0).toBe(1);
  expect(abc.c / 2).toBe(1);
});

test("returns original object references when possible", function () {
  const target = {
    a: 1,
    b: {
      c: 3,
      d: 4,
    },
    e: 5,
  };

  expect(
    mergeDeep(target, {
      b: {
        c: 3,
      },
    })
  ).toBe(target);

  const partial = mergeDeep(target, {
    a: 1,
    b: {
      c: 3,
    },
    e: "eee",
  });

  expect(partial).not.toBe(target);
  expect(partial.b).toBe(target.b);

  const multiple = mergeDeep(
    target,
    {
      a: 1,
    },
    {
      b: {
        d: 4,
      },
    },
    {
      e: 5,
    }
  );

  expect(multiple).toBe(target);

  const targetWithArrays = {
    a: 1,
    b: [
      2,
      {
        c: [3, 4],
        d: 5,
      },
      6,
    ],
    e: [7, 8, 9],
  };

  expect(
    mergeDeep(targetWithArrays, {
      e: [],
    })
  ).toBe(targetWithArrays);

  expect(
    mergeDeep(targetWithArrays, {
      e: [, , /*hole*/ /*hole*/ 9],
    })
  ).toBe(targetWithArrays);

  expect(
    mergeDeep(targetWithArrays, {
      a: 1,
      e: [7, 8],
    })
  ).toBe(targetWithArrays);

  expect(
    mergeDeep(targetWithArrays, {
      b: [
        2,
        {
          c: [],
          d: 5,
        },
      ],
    })
  ).toBe(targetWithArrays);

  expect(
    mergeDeep(targetWithArrays, {
      b: [
        2,
        {
          c: [3],
          d: 5,
        },
        6,
      ],
      e: [],
    })
  ).toBe(targetWithArrays);

  const nestedInequality = mergeDeep(targetWithArrays, {
    b: [
      2,
      {
        c: [3],
        d: 5,
      },
      "wrong",
    ],
    e: [],
  });

  expect(nestedInequality).not.toBe(targetWithArrays);
  expect(nestedInequality.b).not.toBe(targetWithArrays.b);
  expect(nestedInequality.b[1]).toEqual({
    c: [3, 4],
    d: 5,
  });
  expect(nestedInequality.b[1]).toBe(targetWithArrays.b[1]);

  expect(
    mergeDeep(
      targetWithArrays,
      JSON.parse(JSON.stringify(targetWithArrays)),
      JSON.parse(JSON.stringify(targetWithArrays)),
      JSON.parse(JSON.stringify(targetWithArrays))
    )
  ).toBe(targetWithArrays);
});
