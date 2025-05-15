import type { TupleToIntersection } from "./types/TupleToIntersection.js";

/**
 * Merges the provided objects shallowly and removes
 * all properties with an `undefined` value
 *
 * @internal
 */
export function compact<TArgs extends any[]>(
  ...objects: TArgs
): TupleToIntersection<TArgs> {
  const result = {} as TupleToIntersection<TArgs>;

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
