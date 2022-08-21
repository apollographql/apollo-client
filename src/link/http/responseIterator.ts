/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/index.ts
 */

import { Response as NodeResponse } from "node-fetch";
import { Readable as NodeReadableStream } from "stream";

import asyncIterator from "./iterators/async";
import nodeStreamIterator from "./iterators/nodeStream";
import promiseIterator from "./iterators/promise";
import readerIterator from "./iterators/reader";

const hasIterator = typeof Symbol !== "undefined" && Symbol.asyncIterator;

export function responseIterator<T>(
  response: Response | NodeResponse
): AsyncIterableIterator<T> {
  if (response === undefined)
    throw new Error("Missing response for responseIterator");

  // determine the body
  let body: unknown = response;

  // node-fetch, browser fetch, undici
  if ((response as NodeResponse).body) body = (response as NodeResponse).body;

  // adapt the body
  if (hasIterator && (body as AsyncIterableIterator<T>)[Symbol.asyncIterator])
    return asyncIterator<T>(body as AsyncIterableIterator<T>);

  if ((body as ReadableStream<T>).getReader)
    return readerIterator<T>((body as ReadableStream<T>).getReader());
  if ((body as Blob).stream)
    return readerIterator<T>(
      ((body as Blob).stream() as unknown as ReadableStream<T>).getReader()
    );
  if ((body as Blob).arrayBuffer)
    return promiseIterator<T>((body as Blob).arrayBuffer());
  if ((body as NodeReadableStream).pipe)
    return nodeStreamIterator<T>(body as NodeReadableStream);

  throw new Error(
    "Unknown body type for responseIterator. Maybe you are not passing a streamable response"
  );
}
