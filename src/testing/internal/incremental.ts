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
  const CLOSE = Symbol();
  type StreamController = ReadableStreamDefaultController<
    Chunks & { [hasNextSymbol]: boolean }
  >;
  let streamController: ReadableStreamDefaultController<
    Chunks & { [hasNextSymbol]: boolean }
  > | null = null;
  let sentInitialChunk = false;

  const queue: Array<(Chunks & { [hasNextSymbol]: boolean }) | typeof CLOSE> =
    [];

  function processQueue(streamController: StreamController) {
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
        processQueue(c);
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

  function close() {
    if (streamController) {
      streamController.close();
    } else {
      queue.push(CLOSE);
    }

    streamController = null;
    sentInitialChunk = false;
  }

  function enqueue(chunk: Chunks, hasNext: boolean) {
    const payload = { ...chunk, [hasNextSymbol]: hasNext };

    if (streamController) {
      streamController.enqueue(payload);
    } else {
      queue.push(payload);
    }

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
    enqueueProtocolErrorChunk(errors: GraphQLFormattedError[]) {
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

  enqueue({} as any, true);

  return {
    httpLink,
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
