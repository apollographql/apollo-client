/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/reader.ts
 */

const hasIterator = typeof Symbol !== "undefined" && Symbol.asyncIterator;

export default function readerIterator<T>(
  reader: ReadableStreamDefaultReader<T>
): AsyncIterableIterator<T> {
  const iterator = {
    // next(): Promise<IteratorResult<T, boolean>> {
    next() {
      return reader.read();
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
