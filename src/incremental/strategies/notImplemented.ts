import { hasDirectives } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import type { Incremental } from "../types.js";

const no = (_result: unknown): _result is never => false;

interface NonIncrementalResult extends Incremental.ExecutionResult {
  Initial: unknown;
  Subsequent: unknown;
}

export function notImplementedStrategy(): Incremental.Strategy<NonIncrementalResult> {
  return {
    isIncrementalResult: no,
    isIncrementalSubsequentResult: no,
    isIncrementalInitialResult: no,
    prepareRequest: (request) => {
      invariant(
        !hasDirectives(["defer"], request.query),
        "`@defer` is not supported without specifying an incremental strategy. Please pass one as the `incrementalStrategy` option to `ApolloClient`."
      );

      return request;
    },
    // This code path can never be reached, so we won't implement it.
    startRequest: undefined as any,
  };
}
