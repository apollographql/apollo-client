import { isNonNullObject } from "./isNonNullObject.js";

const { hasOwnProperty } = Object.prototype;

type ReconcilerFunction = (
  this: DeepMerger,
  target: Record<string | number, any>,
  source: Record<string | number, any>,
  property: string | number
) => any;

const defaultReconciler: ReconcilerFunction = function (
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
    reconciler?: ReconcilerFunction;
  }

  export interface MergeOptions {
    atPath?: ReadonlyArray<string | number>;
  }

  export type ArrayMergeStrategy =
    // Truncate the target array to the source length, then deep merge the array
    // items at the same index
    | "truncate"
    // Combine arrays and deep merge array items for items at the same index.
    // This is the default
    | "combine";
}

const objForKey = (key: string | number) => {
  return isNaN(+key) ? {} : [];
};

/** @internal */
export class DeepMerger {
  private reconciler: ReconcilerFunction;
  constructor(private options: DeepMerger.Options = {}) {
    this.reconciler = options.reconciler || defaultReconciler;
  }

  public merge(
    target: any,
    source: any,
    mergeOptions: DeepMerger.MergeOptions = {}
  ): any {
    const atPath = mergeOptions.atPath;

    if (atPath?.length) {
      const [head, ...tail] = atPath;
      if (target === undefined) {
        target = objForKey(head);
      }
      let nestedTarget = target[head];
      if (nestedTarget === undefined && tail.length) {
        nestedTarget = objForKey(tail[0]);
      }
      const nestedSource = this.merge(nestedTarget, source, {
        ...mergeOptions,
        atPath: tail,
      });
      if (nestedTarget !== nestedSource) {
        target = this.shallowCopyForMerge(target);
        target[head] = nestedSource;
      }
      return target;
    }

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
            const result = this.reconciler(target, source, sourceKey);
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
