/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/promise.ts
 */

import { hasIterator } from "../../../utilities/common/responseIterator";

interface PromiseIterator<T> {
  next(): Promise<IteratorResult<T, ArrayBuffer | undefined>>;
  [Symbol.asyncIterator]?(): AsyncIterator<T>;
}

export default function promiseIterator<T>(
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
            // @ts-ignore
            resolve({ value, done: false });
          })
          .catch(reject);
      });
    },
  };

  if (hasIterator) {
    iterator[Symbol.asyncIterator] = function (): AsyncIterator<T> {
      return this;
    };
  }

  return iterator as AsyncIterableIterator<T>;
}
