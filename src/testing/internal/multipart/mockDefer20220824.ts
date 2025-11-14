import type {
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
  GraphQLFormattedError,
} from "graphql-17-alpha2";

import { mockMultipartStream } from "./utils.js";

export function mockDefer20220824<
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
