import type { Incremental } from "../types.js";

export function notImplementedStrategy(): Incremental.Strategy<never> {
  return {
    isIncrementalPatchResult: (result): result is never => false,
    prepareRequest: (request) => request,
    startRequest: () => {
      throw new Error(
        "`@defer` is not supported. Please use a different strategy."
      );
    },
  };
}
