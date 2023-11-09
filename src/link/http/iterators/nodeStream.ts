/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/nodeStream.ts
 */

import type { Readable as NodeReadableStream } from "stream";
import { canUseAsyncIteratorSymbol } from "../../../utilities/index.js";

interface NodeStreamIterator<T> {
  next(): Promise<IteratorResult<T, boolean | undefined>>;
  [Symbol.asyncIterator]?(): AsyncIterator<T>;
}

export default function nodeStreamIterator<T>(
  stream: NodeReadableStream
): AsyncIterableIterator<T> {
  let cleanup: (() => void) | null = null;
  let error: Error | null = null;
  let done = false;
  const data: unknown[] = [];

  const waiting: [
    (
      value:
        | IteratorResult<T, boolean | undefined>
        | PromiseLike<IteratorResult<T, boolean | undefined>>
    ) => void,
    (reason?: any) => void,
  ][] = [];

  function onData(chunk: any) {
    if (error) return;
    if (waiting.length) {
      const shiftedArr = waiting.shift();
      if (Array.isArray(shiftedArr) && shiftedArr[0]) {
        return shiftedArr[0]({ value: chunk, done: false });
      }
    }
    data.push(chunk);
  }
  function onError(err: Error) {
    error = err;
    const all = waiting.slice();
    all.forEach(function (pair) {
      pair[1](err);
    });
    !cleanup || cleanup();
  }
  function onEnd() {
    done = true;
    const all = waiting.slice();
    all.forEach(function (pair) {
      pair[0]({ value: undefined, done: true });
    });
    !cleanup || cleanup();
  }

  cleanup = function () {
    cleanup = null;
    stream.removeListener("data", onData);
    stream.removeListener("error", onError);
    stream.removeListener("end", onEnd);
    stream.removeListener("finish", onEnd);
    stream.removeListener("close", onEnd);
  };
  stream.on("data", onData);
  stream.on("error", onError);
  stream.on("end", onEnd);
  stream.on("finish", onEnd);
  stream.on("close", onEnd);

  function getNext(): Promise<IteratorResult<T, boolean | undefined>> {
    return new Promise(function (resolve, reject) {
      if (error) return reject(error);
      if (data.length)
        return resolve({ value: data.shift() as T, done: false });
      if (done) return resolve({ value: undefined, done: true });
      waiting.push([resolve, reject]);
    });
  }

  const iterator: NodeStreamIterator<T> = {
    next(): Promise<IteratorResult<T, boolean | undefined>> {
      return getNext();
    },
  };

  if (canUseAsyncIteratorSymbol) {
    iterator[Symbol.asyncIterator] = function (): AsyncIterator<T> {
      return this;
    };
  }

  return iterator as AsyncIterableIterator<T>;
}
