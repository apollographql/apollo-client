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
export class DeepMerger<TContextArgs extends any[]> {
  constructor(
    private reconciler: ReconcilerFunction<TContextArgs> = defaultReconciler as any as ReconcilerFunction<TContextArgs>
  ) {}

  public merge(target: any, source: any, ...context: TContextArgs): any {
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
