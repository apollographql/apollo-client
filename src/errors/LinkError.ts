import type { ErrorLike } from "@apollo/client";

const registry = new WeakSet<ErrorLike>();

/** @internal Please do not use directly. */
export function registerLinkError(error: ErrorLike) {
  registry.add(error);
}

/**
 * A facade error type that keeps a registry of errors emitted from the link
 * chain. `LinkError` is not an error class itself but rather a utility to
 * detect whether an error originated from the link chain.
 *
 * @remarks
 *
 * Use `LinkError` to distinguish between errors from the link chain and custom
 * errors. This is helpful for retrying an operation at the call site only when
 * the error originates from the link chain.
 *
 * @example
 *
 * The following example creates a custom wrapped query function that detects
 * whether the query includes an operation name and throws if not.
 *
 * ```ts
 * import { LinkError } from "@apollo/client/errors";
 *
 * async function runQuery<TData>(query: TypedDocumentNode<TData>) {
 *   if (!hasOperationName(query)) {
 *     throw new Error("Queries should have operation names.");
 *   }
 *
 *   return client.watchQuery({ query });
 * }
 *
 * try {
 *   const result = await runQuery(query);
 * } catch (error) {
 *   // Only log the error if the error wasn't our own custom thrown error
 *   if (LinkError.is(error)) {
 *     console.log("Got network error:", error.message);
 *   }
 * }
 * ```
 */
export const LinkError = {
  /**
   * A method that determines whether an error originated from the link chain.
   * `is` does not provide any type narrowing.
   *
   * @example
   *
   * ```ts
   * if (LinkError.is(error)) {
   *   // The error originated from the link chain
   *   console.log("Got network error:", error.message);
   * }
   * ```
   */
  is: (error: unknown) => registry.has(error as ErrorLike),
};
