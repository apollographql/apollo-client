import type {
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
} from "graphql-17-alpha9";

import { mockMultipartStream } from "./utils.js";

export function mockDeferStreamGraphQL17Alpha9<
  TData = Record<string, unknown>,
  TExtensions = Record<string, unknown>,
>() {
  const { httpLink, enqueue } = mockMultipartStream<
    | FormattedInitialIncrementalExecutionResult<TData, TExtensions>
    | FormattedSubsequentIncrementalExecutionResult<TData, TExtensions>
  >({
    responseHeaders: new Headers({
      "Content-Type": 'multipart/mixed; boundary="-"',
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
  };
}
