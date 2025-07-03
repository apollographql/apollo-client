import type { RejectedPromise } from "./types/RejectedPromise.js";

/** @internal */
export function createRejectedPromise<TValue = unknown>(reason: unknown) {
  const promise = Promise.reject(reason) as RejectedPromise<TValue>;

  // prevent potential edge cases leaking unhandled error rejections
  promise.catch(() => {});

  promise.status = "rejected";
  promise.reason = reason;

  return promise;
}
