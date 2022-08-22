/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/reader.ts
 */

import { hasIterator } from "../../../utilities/common/responseIterator";

interface ReaderIterator<T> {
  next(): Promise<ReadableStreamDefaultReadResult<T>>;
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

  if (hasIterator) {
    iterator[Symbol.asyncIterator] = function (): AsyncIterator<T> {
      return this;
    };
  }

  return iterator as AsyncIterableIterator<T>;
}
