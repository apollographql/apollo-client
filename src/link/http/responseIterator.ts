/**
 * Original source:
 * https://github.com/kmalakoff/response-iterator/blob/master/src/index.ts
 */

import { Response as NodeResponse } from "node-fetch";
import {
  isAsyncIterableIterator,
  isBlob,
  isNodeResponse,
  isNodeReadableStream,
  isReadableStream,
  isStreamableBlob,
} from "../../utilities/common/responseIterator";

import asyncIterator from "./iterators/async";
import nodeStreamIterator from "./iterators/nodeStream";
import promiseIterator from "./iterators/promise";
import readerIterator from "./iterators/reader";

export function responseIterator<T>(
  response: Response | NodeResponse
): AsyncIterableIterator<T> {
  let body: unknown = response;

  if (isNodeResponse(response)) body = response.body;

  if (isAsyncIterableIterator(body)) return asyncIterator<T>(body);

  if (isReadableStream(body)) return readerIterator<T>(body.getReader());

  // this errors without casting to ReadableStream<T>
  // because Blob.stream() returns a NodeJS ReadableStream
  if (isStreamableBlob(body)) {
    return readerIterator<T>(
      (body.stream() as unknown as ReadableStream<T>).getReader()
    );
  }

  if (isBlob(body)) return promiseIterator<T>(body.arrayBuffer());

  if (isNodeReadableStream(body)) return nodeStreamIterator<T>(body);

  throw new Error(
    "Unknown body type for responseIterator. Please pass a streamable response."
  );
}
