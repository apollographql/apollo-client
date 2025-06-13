import { DeepMerger } from "@apollo/client/utilities/internal";

test("supports custom reconciler functions", function () {
  const merger = new DeepMerger(function (target, source, key) {
    const targetValue = target[key];
    const sourceValue = source[key];
    if (Array.isArray(sourceValue)) {
      if (!Array.isArray(targetValue)) {
        return sourceValue;
      }
      return [...targetValue, ...sourceValue];
    }
    return this.merge(targetValue, sourceValue);
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

test("provides optional context to reconciler function", function () {
  const contextObject = {
    contextWithSpaces: "c o n t e x t",
  };

  const shallowContextValues: any[] = [];
  const shallowMerger = new DeepMerger<(typeof contextObject)[]>(function (
    target,
    source,
    property,
    context: typeof contextObject
  ) {
    shallowContextValues.push(context);
    // Deliberately not passing context down to nested levels.
    return this.merge(target[property], source[property]);
  });

  const typicalContextValues: any[] = [];
  const typicalMerger = new DeepMerger<(typeof contextObject)[]>(function (
    target,
    source,
    property,
    context
  ) {
    typicalContextValues.push(context);
    // Passing context down this time.
    return this.merge(target[property], source[property], context);
  });

  const left = {
    a: 1,
    b: {
      c: 2,
      d: [3, 4],
    },
    e: 5,
  };

  const right = {
    b: {
      d: [3, 4, 5],
    },
  };

  const expected = {
    a: 1,
    b: {
      c: 2,
      d: [3, 4, 5],
    },
    e: 5,
  };

  expect(shallowMerger.merge(left, right, contextObject)).toEqual(expected);
  expect(typicalMerger.merge(left, right, contextObject)).toEqual(expected);

  expect(shallowContextValues.length).toBe(2);
  expect(shallowContextValues[0]).toBe(contextObject);
  expect(shallowContextValues[1]).toBeUndefined();

  expect(typicalContextValues.length).toBe(2);
  expect(typicalContextValues[0]).toBe(contextObject);
  expect(typicalContextValues[1]).toBe(contextObject);
});
