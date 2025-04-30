import type { FulfilledPromise } from "./types/FulfilledPromise.js";

/** @internal */
export function createFulfilledPromise<TValue>(value: TValue) {
  const promise = Promise.resolve(value) as FulfilledPromise<TValue>;

  promise.status = "fulfilled";
  promise.value = value;

  return promise;
}
