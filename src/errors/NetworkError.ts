import type { ErrorLike } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client";

const registry = new WeakSet();

/**
 * A facade error type that keeps a registry of errors emitted from the link
 * chain. Determine if an error is from the link chain using `NetworkError.is`.
 */
export const NetworkError = {
  /**
   * Determine if the error is an error emitted from the link chain.
   */
  is: (error: unknown) => registry.has(error as ErrorLike),

  /** @internal */
  register: (error: ErrorLike) => {
    if (!CombinedGraphQLErrors.is(error)) {
      registry.add(error);
    }
  },
};
