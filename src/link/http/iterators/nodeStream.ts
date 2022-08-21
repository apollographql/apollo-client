/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/iterators/nodeStream.ts
 */

import { Readable as NodeReadableStream } from "stream";

const hasIterator = typeof Symbol !== "undefined" && Symbol.asyncIterator;

export default function nodeStreamIterator<T>(
  stream: NodeReadableStream
): AsyncIterableIterator<T> {
  let cleanup: (() => void) | null = null;
  let error: Error | null = null;
  let done = false;
  const data: unknown[] = [];
  // @ts-ignore
  const waiting = [];

  function onData(chunk: any) {
    if (error) return;
    if (waiting.length)
      // @ts-ignore
      return waiting.shift()[0]({ value: chunk, done: false });
    data.push(chunk);
  }
  function onError(err: Error) {
    error = err;
    // @ts-ignore
    const all = waiting.slice();
    all.forEach(function (pair) {
      pair[1](err);
    });
    !cleanup || cleanup();
  }
  function onEnd() {
    done = true;
    // @ts-ignore
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

  function getNext(): Promise<IteratorResult<T, boolean>> {
    return new Promise(function (resolve, reject) {
      if (error) return reject(error);
      // @ts-ignore
      if (data.length) return resolve({ value: data.shift(), done: false });
      // @ts-ignore
      if (done) return resolve({ value: undefined, done: true });
      waiting.push([resolve, reject]);
    });
  }

  const iterator = {
    next(): Promise<IteratorResult<T, boolean>> {
      return getNext();
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
