import type { Incremental } from "../types.js";

export function notImplementedStrategy(): Incremental.Strategy {
  return {
    prepareRequest: (request) => request,
    startRequest: () => {
      throw new Error(
        "`@defer` is not supported. Please us a different strategy"
      );
    },
  };
}
