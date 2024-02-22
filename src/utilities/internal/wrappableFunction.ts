import { invariant } from "../globals/index.js";

const implementationSymbol = Symbol.for("apollo.wrappable.implementation");
const wrapperSymbol = Symbol.for("apollo.wrappable.wrapper");

/**
 * @internal
 *
 * Marks a function as wrappable, which means you can later change the function
 * implementation by using `wrapFunction`.
 */
export function createWrappableFunction<T extends (...args: any[]) => any>(
  fn: T
): T {
  /*
   * Using the `const namedFn = { [fn.name]: () => ... }[fn.name] as T` pattern
   * to create a wrapped function with the same name as the original one, for
   * nicer stack traces
   */
  const wrapped = {
    [fn.name]: function () {
      // Instead of directly calling the original implemenation, we call the
      // wrapper function.
      return wrapped[wrapperSymbol].apply(this, arguments as any);
    },
  }[fn.name] as T & { [implementationSymbol]: T; [wrapperSymbol]: T };
  const config = {
    enumerable: false,
    value: fn,
    writable: true,
  } satisfies PropertyDescriptor;
  // We define the original implementation and the wrapper function as hidden properties
  // the wrapper will start out as the original implementation, but can be changed
  // using `wrapFunction`
  Object.defineProperty(wrapped, implementationSymbol, config);
  Object.defineProperty(wrapped, wrapperSymbol, config);

  return wrapped;
}

/**
 * A type assertion function to check that we really have a wrappable function
 * passed into `wrapFunction`.
 */
function assertWrappable<T extends (...args: any[]) => any>(
  potentiallyWrapable: T
): asserts potentiallyWrapable is T & {
  [implementationSymbol]: T;
  [wrapperSymbol]: T;
} {
  invariant(
    implementationSymbol in potentiallyWrapable &&
      wrapperSymbol in potentiallyWrapable,
    "Trying to wrap a function (%s) that is not wrappable",
    potentiallyWrapable.name
  );
}
/**
 * @internal
 *
 * Allows you to replace the existing implementation of a wrappable function.
 * @example
 * ```js
 * // create a wrappable function
 * const myFn = createWrappableFunction(() => "original");
 * myFn(); // "original"
 *
 * // wrap the function - you can call the original implementation from the wrapper
 * wrapFunction(myFn, (orig) => () => orig() + " wrapped");
 * myFn(); // "original wrapped"
 *
 * // calling `wrapFunction` again will replace the last wrapper
 * wrapFunction(myFn, () => () => "replaced the last wrapper");
 * myFn(); // "replaced the last wrapper"
 *
 * // you can also access the last wrapper from the `createWrapper` function,
 * // possibly wrapping around it
 * wrapFunction(myFn, (_, lastWrapper) => () => `wrapped the last wrapper, which was '${lastWrapper()}'`);
 * myFn(); // "wrapped the last wrapper, which was 'replaced the last wrapper'"
 * ```
 */
export function wrapFunction<T extends (...args: any[]) => any>(
  fn: T,
  createWrapper: (orig: T, lastWrapper: T) => T
): T {
  assertWrappable(fn);
  fn[wrapperSymbol] = createWrapper(
    fn[implementationSymbol],
    fn[wrapperSymbol]
  );
  return fn;
}
