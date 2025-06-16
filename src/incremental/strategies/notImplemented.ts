import { hasDirectives } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import type { Incremental } from "../types.js";

const no = (_result: unknown): _result is never => false;

export function notImplementedStrategy(): Incremental.Strategy<never> {
  return {
    isIncrementalResult: no,
    isIncrementalSubsequentResult: no,
    isIncrementalInitialResult: no,
    prepareRequest: (request) => {
      invariant(
        !hasDirectives(["defer"], request.query),
        "`@defer` is not supported. Please use a different strategy."
      );
      // TODO: throwing behavior needs a test - does this end up in the stream correctly?

      return request;
    },
    startRequest: () => {
      // TODO: throwing behavior needs a test - does this end up in the stream correctly?
      invariant(
        false,
        "`@defer` is not supported. Please use a different strategy."
      );
    },
  };
}
