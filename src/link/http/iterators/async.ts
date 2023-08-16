/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/async.ts
 */

export default function asyncIterator<T>(
  source: AsyncIterableIterator<T>
): AsyncIterableIterator<T> {
  const iterator = source[Symbol.asyncIterator]();
  return {
    next(): Promise<IteratorResult<T, boolean>> {
      return iterator.next();
    },
    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
      return this;
    },
  };
}
