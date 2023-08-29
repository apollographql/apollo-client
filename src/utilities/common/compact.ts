import type { TupleToIntersection } from "./mergeDeep.js";

/**
 * Merges the provided objects shallowly and removes
 * all properties with an `undefined` value
 */
export function compact<TArgs extends any[]>(
  ...objects: TArgs
): TupleToIntersection<TArgs> {
  const result = Object.create(null);

  objects.forEach((obj) => {
    if (!obj) return;
    Object.keys(obj).forEach((key) => {
      const value = (obj as any)[key];
      if (value !== void 0) {
        result[key] = value;
      }
    });
  });

  return result;
}
