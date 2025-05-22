import { identity } from "./identity.js";
import { noop } from "./noop.js";

export namespace LazyPromise {
  export type Executor<T> = (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void
  ) => void;
}

/**
 * @internal
 *
 * A "lazy" variant of the native Promise.
 * The executor function is not called until the first `.then()`, `.catch()`,
 * or `.finally()` called.
 *
 * ⚠️ `return`ing a `LazyPromise` from an `async function` will immediately
 * call `.then` and invoke the executor function, turning it from "lazy" to "eager".
 *
 * This promise should not be combined with tools like `preventUnhandledRejection`
 * as those will immediately call `.catch` and execute the promise constructor.
 * This is also not necessary, as the promise will never throw an error
 * if the executor is never called, so uncaught promise rejections can only be
 * initiated by userland code that calls `.then` without an `onRejected` argument,
 * but not `.catch`.
 * In these cases, the default behavior of an unhandled promise rejection is
 * desired.
 */
/*
 * This class explicitly does not subclass the native Promise class.
 *
 * This is due to the way that `await` works in ECMAScript:
 * https://tc39.es/ecma262/multipage/control-abstraction-objects.html#await
 *
 * `await` calls `PromiseResolve(PromiseClass, promise)` followed by `PerformPromiseThen`.
 * If `promise` in `PromiseResolve` is an instance of `Promise`, it will return that `Promise`
 * instance immediately.
 * In the next step, `PerformPromiseThen` will then try to access the internal `[[PromiseState]]`,
 * `[PromiseResult]]` slots and append to `[[PromiseFulfillReactions]]` and `[[PromiseRejectReactions]]`.
 * This will never call `.then` directly, so our lazy executor function would never be called.
 *
 * Instead, we return a thenable object, which will cause `PromiseResolve` to call
 * `NewPromiseCapability(PromiseClass)` followed by `promiseCapability.[[Resolve]].call(undefined, thenbable)`,
 * which is comparable to calling `Promise.resolve(thenable)`, which whill call
 * the `.then` method of the thenable.
 */
export class LazyPromise<T> implements /* but not extends */ Promise<T> {
  private executor?: LazyPromise.Executor<T>;
  private promise?: Promise<T>;
  constructor(
    executor: LazyPromise.Executor<T>,
    preventUnhandledRejection = true
  ) {
    this.executor = executor;
    this.eager = () => {
      const promise = this.then(identity);
      if (preventUnhandledRejection) {
        promise.catch(noop);
      }
      return promise;
    };
  }

  /** If the LazyQuery hasn't started yet, kick it off. */
  eager: () => Promise<T>;

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    if (!this.promise) {
      this.promise = new Promise<T>(this.executor!);
      delete this.executor;
    }
    return this.promise.then<TResult1, TResult2>(onfulfilled, onrejected);
  }
  // will call `.then`: https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.prototype.catch step 2
  catch = Promise.prototype.catch;
  // will call `.then`: https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.prototype.finally step 7
  finally = Promise.prototype.finally;

  static resolve<T>(value: T): LazyPromise<T> {
    return new LazyPromise<T>((resolve) => resolve(value));
  }

  [Symbol.toStringTag] = "LazyPromise";
}
