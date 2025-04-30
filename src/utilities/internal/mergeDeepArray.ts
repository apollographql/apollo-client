import { DeepMerger } from "./DeepMerger.js";

// In almost any situation where you could succeed in getting the
// TypeScript compiler to infer a tuple type for the sources array, you
// could just use mergeDeep instead of mergeDeepArray, so instead of
// trying to convert T[] to an intersection type we just infer the array
// element type, which works perfectly when the sources array has a
// consistent element type.
/** @internal */
export function mergeDeepArray<T>(sources: T[]): T {
  let target = sources[0] || ({} as T);
  const count = sources.length;
  if (count > 1) {
    const merger = new DeepMerger();
    for (let i = 1; i < count; ++i) {
      target = merger.merge(target, sources[i]);
    }
  }
  return target;
}
