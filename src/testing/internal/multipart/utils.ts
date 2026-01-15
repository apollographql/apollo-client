import {
  ReadableStream as NodeReadableStream,
  TextEncoderStream,
  TransformStream,
} from "node:stream/web";

import { HttpLink } from "@apollo/client/link/http";

const hasNextSymbol = Symbol("hasNext");

export function mockMultipartStream<Chunks>({
  responseHeaders,
}: {
  responseHeaders: Headers;
}) {
  type Payload = Chunks & { [hasNextSymbol]: boolean };
  const CLOSE = Symbol();
  let streamController: ReadableStreamDefaultController<Payload> | null = null;
  let sentInitialChunk = false;

  const queue: Array<Payload | typeof CLOSE> = [];

  function processQueue() {
    if (!streamController) {
      throw new Error("Cannot process queue without stream controller");
    }

    let chunk;
    while ((chunk = queue.shift())) {
      if (chunk === CLOSE) {
        streamController.close();
      } else {
        streamController.enqueue(chunk);
      }
    }
  }

  function createStream() {
    return new NodeReadableStream<Chunks & { [hasNextSymbol]: boolean }>({
      start(c) {
        streamController = c;
        processQueue();
      },
    })
      .pipeThrough(
        new TransformStream<Chunks & { [hasNextSymbol]: boolean }, string>({
          transform: (chunk, controller) => {
            controller.enqueue(
              (!sentInitialChunk ? "\r\n---\r\n" : "") +
                "content-type: application/json; charset=utf-8\r\n\r\n" +
                JSON.stringify(chunk) +
                (chunk[hasNextSymbol] ? "\r\n---\r\n" : "\r\n-----\r\n")
            );
            sentInitialChunk = true;
          },
        })
      )
      .pipeThrough(new TextEncoderStream());
  }

  const httpLink = new HttpLink({
    fetch(input, init) {
      return Promise.resolve(
        new Response(
          createStream() satisfies NodeReadableStream<Uint8Array> as ReadableStream<Uint8Array>,
          {
            status: 200,
            headers: responseHeaders,
          }
        )
      );
    },
  });

  function queueNext(event: Payload | typeof CLOSE) {
    queue.push(event);

    if (streamController) {
      processQueue();
    }
  }

  function close() {
    queueNext(CLOSE);

    streamController = null;
    sentInitialChunk = false;
  }

  function enqueue(chunk: Chunks, hasNext: boolean) {
    queueNext({ ...chunk, [hasNextSymbol]: hasNext });

    if (!hasNext) {
      close();
    }
  }

  return {
    httpLink,
    enqueue,
    close,
  };
}
