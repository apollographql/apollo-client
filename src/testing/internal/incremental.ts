import { HttpLink } from "../../link/http/index.js";
import type {
  GraphQLFormattedError,
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from "graphql-17-alpha2";
import type { GraphQLError } from "graphql";
import {
  ReadableStream as NodeReadableStream,
  TextEncoderStream,
  TransformStream,
} from "node:stream/web";
import type { ApolloPayloadResult } from "../../core/index.js";

const hasNextSymbol = Symbol("hasNext");

export function mockIncrementalStream<Chunks>({
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

export function mockDeferStream<
  TData = Record<string, unknown>,
  TExtensions = Record<string, unknown>,
>() {
  const { httpLink, enqueue } = mockIncrementalStream<
    | InitialIncrementalExecutionResult<TData, TExtensions>
    | SubsequentIncrementalExecutionResult<TData, TExtensions>
  >({
    responseHeaders: new Headers({
      "Content-Type": 'multipart/mixed; boundary="-"; deferSpec=20220824',
    }),
  });
  return {
    httpLink,
    enqueueInitialChunk(
      chunk: InitialIncrementalExecutionResult<TData, TExtensions>
    ) {
      enqueue(chunk, chunk.hasNext);
    },
    enqueueSubsequentChunk(
      chunk: SubsequentIncrementalExecutionResult<TData, TExtensions>
    ) {
      enqueue(chunk, chunk.hasNext);
    },
    enqueueErrorChunk(errors: GraphQLFormattedError[]) {
      enqueue(
        {
          hasNext: true,
          incremental: [
            {
              // eslint-disable-next-line @typescript-eslint/ban-types
              errors: errors as GraphQLError[],
            },
          ],
        } satisfies SubsequentIncrementalExecutionResult<TData, TExtensions>,
        true
      );
    },
  };
}

export function mockMultipartSubscriptionStream<
  TData = Record<string, unknown>,
  TExtensions = Record<string, unknown>,
>() {
  const { httpLink, enqueue } = mockIncrementalStream<
    ApolloPayloadResult<TData, TExtensions>
  >({
    responseHeaders: new Headers({
      "Content-Type": "multipart/mixed",
    }),
  });

  enqueueHeartbeat();

  function enqueueHeartbeat() {
    enqueue({} as any, true);
  }

  return {
    httpLink,
    enqueueHeartbeat,
    enqueuePayloadResult(
      payload: ApolloPayloadResult<TData, TExtensions>["payload"],
      hasNext = true
    ) {
      enqueue({ payload }, hasNext);
    },
    enqueueProtocolErrors(errors: ApolloPayloadResult["errors"]) {
      enqueue({ payload: null, errors }, false);
    },
  };
}
