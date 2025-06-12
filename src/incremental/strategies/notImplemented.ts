import { hasDirectives } from "@apollo/client/utilities/internal";

import type { Incremental } from "../types.js";

export function notImplementedStrategy(): Incremental.Strategy<never> {
  return {
    isIncrementalResult: (result): result is never => false,
    isIncrementalSubsequentResult: (result): result is never => false,
    isIncrementalInitialResult: (result): result is never => false,
    prepareRequest: (request) => {
      if (hasDirectives(["defer"], request.query)) {
        throw new Error(
          "`@defer` is not supported. Please use a different strategy."
        );
      }

      return request;
    },
    startRequest: () => {
      throw new Error(
        "`@defer` is not supported. Please use a different strategy."
      );
    },
  };
}
