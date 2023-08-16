/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/promise.ts
 */

import { canUseAsyncIteratorSymbol } from "../../../utilities/index.js";

interface PromiseIterator<T> {
  next(): Promise<IteratorResult<T, ArrayBuffer | undefined>>;
  [Symbol.asyncIterator]?(): AsyncIterator<T>;
}

export default function promiseIterator<T = ArrayBuffer>(
  promise: Promise<ArrayBuffer>
): AsyncIterableIterator<T> {
  let resolved = false;

  const iterator: PromiseIterator<T> = {
    next(): Promise<IteratorResult<T, ArrayBuffer | undefined>> {
      if (resolved)
        return Promise.resolve({
          value: undefined,
          done: true,
        });
      resolved = true;
      return new Promise(function (resolve, reject) {
        promise
          .then(function (value) {
            resolve({ value: value as unknown as T, done: false });
          })
          .catch(reject);
      });
    },
  };

  if (canUseAsyncIteratorSymbol) {
    iterator[Symbol.asyncIterator] = function (): AsyncIterator<T> {
      return this;
    };
  }

  return iterator as AsyncIterableIterator<T>;
}
