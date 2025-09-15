import { isNonNullObject } from "./isNonNullObject.js";

const { hasOwnProperty } = Object.prototype;

type ReconcilerFunction<TContextArgs extends any[]> = (
  this: DeepMerger<TContextArgs>,
  target: Record<string | number, any>,
  source: Record<string | number, any>,
  property: string | number,
  ...context: TContextArgs
) => any;

const defaultReconciler: ReconcilerFunction<any[]> = function (
  target,
  source,
  property
) {
  return this.merge(target[property], source[property]);
};

/** @internal */
export declare namespace DeepMerger {
  export interface Options {
    arrayMerge?: DeepMerger.ArrayMergeStrategy;
  }

  export type ArrayMergeStrategy =
    // Truncate the target array to the source length, then deep merge the array
    // items at the same index
    | "truncate"
    // Combine arrays and deep merge array items for items at the same index.
    // This is the default
    | "combine";
}

/** @internal */
export class DeepMerger<TContextArgs extends any[] = any[]> {
  constructor(
    private reconciler: ReconcilerFunction<TContextArgs> = defaultReconciler as any as ReconcilerFunction<TContextArgs>,
    private options: DeepMerger.Options = {}
  ) {}

  public merge(target: any, source: any, ...context: TContextArgs): any {
    if (
      Array.isArray(target) &&
      Array.isArray(source) &&
      this.options.arrayMerge === "truncate" &&
      target.length > source.length
    ) {
      target = target.slice(0, source.length);
      this.pastCopies.add(target);
    }

    if (isNonNullObject(source) && isNonNullObject(target)) {
      Object.keys(source).forEach((sourceKey) => {
        if (hasOwnProperty.call(target, sourceKey)) {
          const targetValue = target[sourceKey];
          if (source[sourceKey] !== targetValue) {
            const result = this.reconciler(
              target,
              source,
              sourceKey,
              ...context
            );
            // A well-implemented reconciler may return targetValue to indicate
            // the merge changed nothing about the structure of the target.
            if (result !== targetValue) {
              target = this.shallowCopyForMerge(target);
              target[sourceKey] = result;
            }
          }
        } else {
          // If there is no collision, the target can safely share memory with
          // the source, and the recursion can terminate here.
          target = this.shallowCopyForMerge(target);
          target[sourceKey] = source[sourceKey];
        }
      });

      return target;
    }

    // If source (or target) is not an object, let source replace target.
    return source;
  }

  public isObject = isNonNullObject;

  private pastCopies = new Set<any>();

  public shallowCopyForMerge<T>(value: T): T {
    if (isNonNullObject(value)) {
      if (!this.pastCopies.has(value)) {
        if (Array.isArray(value)) {
          value = (value as any).slice(0);
        } else {
          value = {
            __proto__: Object.getPrototypeOf(value),
            ...value,
          };
        }
        this.pastCopies.add(value);
      }
    }
    return value;
  }
}
