import type {
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
  GraphQLFormattedError,
} from "graphql-17-alpha2";

import type { ApolloPayloadResult } from "@apollo/client";

import { mockMultipartStream } from "./incremental/utils.js";

export function mockDeferStream<
  TData = Record<string, unknown>,
  TExtensions = Record<string, unknown>,
>() {
  const { httpLink, enqueue } = mockMultipartStream<
    | FormattedInitialIncrementalExecutionResult<TData, TExtensions>
    | FormattedSubsequentIncrementalExecutionResult<TData, TExtensions>
  >({
    responseHeaders: new Headers({
      "Content-Type": 'multipart/mixed; boundary="-"; deferSpec=20220824',
    }),
  });
  return {
    httpLink,
    enqueueInitialChunk(
      chunk: FormattedInitialIncrementalExecutionResult<TData, TExtensions>
    ) {
      enqueue(chunk, chunk.hasNext);
    },
    enqueueSubsequentChunk(
      chunk: FormattedSubsequentIncrementalExecutionResult<TData, TExtensions>
    ) {
      enqueue(chunk, chunk.hasNext);
    },
    enqueueErrorChunk(errors: GraphQLFormattedError[]) {
      enqueue(
        {
          hasNext: true,
          incremental: [
            {
              errors,
            },
          ],
        },
        true
      );
    },
  };
}

export function mockMultipartSubscriptionStream<
  TData = Record<string, unknown>,
  TExtensions = Record<string, unknown>,
>() {
  const { httpLink, enqueue } = mockMultipartStream<
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
