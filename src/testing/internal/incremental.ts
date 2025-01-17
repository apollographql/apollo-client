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
  let streamController: ReadableStreamDefaultController<
    Chunks & { [hasNextSymbol]: boolean }
  >;
  let sentInitialChunk = false;
  const stream = new NodeReadableStream<Chunks & { [hasNextSymbol]: boolean }>({
    start(c) {
      streamController = c;
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

  const httpLink = new HttpLink({
    fetch(input, init) {
      return Promise.resolve(
        new Response(
          stream satisfies NodeReadableStream<Uint8Array> as ReadableStream<Uint8Array>,
          {
            status: 200,
            headers: responseHeaders,
          }
        )
      );
    },
  });
  return {
    httpLink,
    streamController: streamController!,
  };
}

export function mockDeferStream<
  TData = Record<string, unknown>,
  TExtensions = Record<string, unknown>,
>() {
  const { httpLink, streamController } = mockIncrementalStream<
    | InitialIncrementalExecutionResult<TData, TExtensions>
    | SubsequentIncrementalExecutionResult<TData, TExtensions>
  >({
    responseHeaders: new Headers({
      "Content-Type": 'multipart/mixed; boundary="-"; deferSpec=20220824',
    }),
  });
  return {
    httpLink,
    streamController: streamController!,
    enqueueInitialChunk(
      chunk: InitialIncrementalExecutionResult<TData, TExtensions>
    ) {
      streamController.enqueue({ ...chunk, [hasNextSymbol]: chunk.hasNext });
      if (!chunk.hasNext) streamController.close();
    },
    enqueueSubsequentChunk(
      chunk: SubsequentIncrementalExecutionResult<TData, TExtensions>
    ) {
      streamController.enqueue({ ...chunk, [hasNextSymbol]: chunk.hasNext });
      if (!chunk.hasNext) streamController.close();
    },
    enqueueProtocolErrorChunk(errors: GraphQLFormattedError[]) {
      streamController.enqueue({
        hasNext: true,
        [hasNextSymbol]: true,
        incremental: [
          {
            // eslint-disable-next-line @typescript-eslint/ban-types
            errors: errors as GraphQLError[],
          },
        ],
      } satisfies SubsequentIncrementalExecutionResult<TData, TExtensions> & {
        [hasNextSymbol]: boolean;
      });
    },
  };
}

export function mockMultipartSubscriptionStream<
  TData = Record<string, unknown>,
  TExtensions = Record<string, unknown>,
>() {
  const { httpLink, streamController } = mockIncrementalStream<
    ApolloPayloadResult<TData, TExtensions>
  >({
    responseHeaders: new Headers({
      "Content-Type": "multipart/mixed",
    }),
  });

  // send initial empty chunk back
  streamController.enqueue({} as any);

  return {
    httpLink,
    streamController: streamController!,
    enqueuePayloadResult(
      payload: ApolloPayloadResult["payload"],
      hasNext = true
    ) {
      streamController.enqueue({ payload, [hasNextSymbol]: hasNext });
      if (!hasNext) streamController.close();
    },
    enqueueErrorResult(
      errors: ApolloPayloadResult["errors"],
      payload: ApolloPayloadResult["payload"] = null
    ) {
      streamController.enqueue({ payload, errors, [hasNextSymbol]: false });
      streamController.close();
    },
  };
}
