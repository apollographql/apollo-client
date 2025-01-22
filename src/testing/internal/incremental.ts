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
  type StreamController = ReadableStreamDefaultController<
    Chunks & { [hasNextSymbol]: boolean }
  >;
  let sentInitialChunk = false;
  let resolve!: (streamController: StreamController) => void;
  let promise!: Promise<StreamController>;

  createPromise();

  function createPromise() {
    promise = new Promise((res) => {
      resolve = res;
    });
  }

  function createStream() {
    return new NodeReadableStream<Chunks & { [hasNextSymbol]: boolean }>({
      start(c) {
        resolve(c);
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

  async function close() {
    const streamController = await promise;
    streamController.close();
    sentInitialChunk = false;
    createPromise();
  }

  async function enqueue(
    chunk: Chunks,
    hasNext: boolean,
    { timeout = 100 }: { timeout?: number } = {}
  ) {
    const streamController = await Promise.race([
      promise,
      new Promise<StreamController>((_, reject) => {
        setTimeout(() => {
          reject("Timeout waiting for creation of ReadableStream controller");
        }, timeout);
      }),
    ]);

    streamController.enqueue({ ...chunk, [hasNextSymbol]: hasNext });

    if (!hasNext) {
      await close();
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

  return {
    httpLink,
    async enqueueInitial() {
      await enqueue({} as any, true);
    },
    async enqueuePayloadResult(
      payload: ApolloPayloadResult<TData, TExtensions>["payload"],
      hasNext = true
    ) {
      await enqueue({ payload }, hasNext);
    },
    async enqueueErrorResult(
      errors: ApolloPayloadResult["errors"],
      payload: ApolloPayloadResult<TData, TExtensions>["payload"] = null
    ) {
      await enqueue({ payload, errors }, false);
    },
  };
}
