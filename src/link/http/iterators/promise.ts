/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/promise.ts
 */

const hasIterator = typeof Symbol !== "undefined" && Symbol.asyncIterator;

export default function promiseIterator<T>(
  promise: Promise<ArrayBuffer>
): AsyncIterableIterator<T> {
  let resolved = false;

  const iterator = {
    next(): Promise<IteratorResult<T, boolean>> {
      // @ts-ignore
      if (resolved) return Promise.resolve({ value: undefined, done: true });
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
    // @ts-ignore
    iterator[Symbol.asyncIterator] = function (): AsyncIterator<T> {
      return this;
    };
  }

  return iterator as AsyncIterableIterator<T>;
}
