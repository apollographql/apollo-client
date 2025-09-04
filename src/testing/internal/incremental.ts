import type { ApolloPayloadResult } from "@apollo/client";

import { mockMultipartStream } from "./incremental/utils.js";

export { mockDefer20220824 } from "./incremental/mockDefer20220824.js";
export { mockDeferStreamGraphQL17Alpha9 } from "./incremental/mockDeferStreamGraphql17Alpha9.js";

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
