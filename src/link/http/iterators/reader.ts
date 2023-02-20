/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/reader.ts
 */

import { canUseAsyncIteratorSymbol } from "../../../utilities";

interface ReaderIterator<T> {
  next(): Promise<ReadableStreamReadResult<T>>;
  [Symbol.asyncIterator]?(): AsyncIterator<T>;
}

export default function readerIterator<T>(
  reader: ReadableStreamDefaultReader<T>
): AsyncIterableIterator<T> {
  const iterator: ReaderIterator<T> = {
    next() {
      return reader.read();
    },
  };

  if (canUseAsyncIteratorSymbol) {
    iterator[Symbol.asyncIterator] = function (): AsyncIterator<T> {
      return this;
    };
  }

  return iterator as AsyncIterableIterator<T>;
}
