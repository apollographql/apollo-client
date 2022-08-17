// import { AxiosResponse } from 'axios';
import { Response as NodeResponse } from "node-fetch";
import { Readable as NodeReadableStream } from "stream";

import asyncIterator from "./iterators/async";
import nodeStreamIterator from "./iterators/nodeStream";
import promiseIterator from "./iterators/promise";
import readerIterator from "./iterators/reader";

// interface CrossFetchResponse {
//   _bodyBlob: Blob;
// }

const hasIterator = typeof Symbol !== "undefined" && Symbol.asyncIterator;

/**
 * @param response A response. Supports fetch, node-fetch, and cross-fetch
 */
export function responseIterator<T>(
  response: unknown
): AsyncIterableIterator<T> {
  if (response === undefined)
    throw new Error("Missing response for responseIterator");

  // determine the body
  let body: unknown = response;
  if ((response as NodeResponse).body) body = (response as NodeResponse).body;
  // node-fetch, browser fetch, undici
  // else if ((response as AxiosResponse).data) body = (response as AxiosResponse).data;
  // axios
  // else if ((response as CrossFetchResponse)._bodyBlob) body = (response as CrossFetchResponse)._bodyBlob; // cross-fetch

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
