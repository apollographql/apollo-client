import type { ErrorLike } from "@apollo/client";

const registry = new WeakSet();

/** @internal Please do not use directly. */
export function registerLinkError(error: ErrorLike) {
  registry.add(error);
}

/**
 * A facade error type that keeps a registry of errors emitted from the link
 * chain. Determine if an error is from the link chain using `NetworkError.is`.
 */
export const LinkError = {
  /**
   * Determine if the error is an error emitted from the link chain.
   */
  is: (error: unknown) => registry.has(error as ErrorLike),
};
