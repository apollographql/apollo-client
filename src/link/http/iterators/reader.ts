/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/reader.ts
 */

interface ReaderIterator<T> {
  next(): Promise<IteratorResult<T, T | undefined>>;
  [Symbol.asyncIterator]?(): AsyncIterator<T>;
}

export default function readerIterator<T>(
  reader: ReadableStreamDefaultReader<T>
): AsyncIterableIterator<T> {
  const iterator: ReaderIterator<T> = {
    next() {
      return reader.read() as Promise<
        | ReadableStreamReadValueResult<T>
        // DoneResult has `value` optional, which doesn't comply with an
        // `IteratorResult`, so we assert it to `T | undefined` instead
        | Required<ReadableStreamReadDoneResult<T | undefined>>
      >;
    },
  };

  iterator[Symbol.asyncIterator] = function (): AsyncIterator<
    T,
    T | undefined
  > {
    return this;
  };

  return iterator as AsyncIterableIterator<T>;
}
