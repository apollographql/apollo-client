import { Observable } from "rxjs";

import { ApolloLink } from "@apollo/client/link";

export declare namespace SetContextLink {
  namespace SetContextLinkDocumentationTypes {
    /**
     * A function that returns an updated context object for an Apollo Link
     * operation.
     *
     * The context setter function is called for each operation and allows you to
     * modify the operation's context before it's passed to the next link in the
     * chain. The returned context object is shallowly merged with the previous
     * context object.
     *
     * @param prevContext - The previous context of the operation (e.g. the value
     * of `operation.getContext()`)
     * @param operation - The GraphQL operation being executed, without the
     * `getContext` and `setContext` methods
     * @returns A partial context object or a promise that resolves to a partial context object
     */
    export function ContextSetter(
      prevContext: Readonly<ApolloLink.OperationContext>,
      operation: SetContextLink.SetContextOperation
    ):
      | Promise<Partial<ApolloLink.OperationContext>>
      | Partial<ApolloLink.OperationContext>;
  }

  /** {@inheritDoc @apollo/client/link/context!SetContextLink.SetContextLinkDocumentationTypes.ContextSetter:function(1)} */
  export type ContextSetter = (
    prevContext: Readonly<ApolloLink.OperationContext>,
    operation: SetContextLink.SetContextOperation
  ) =>
    | Promise<Partial<ApolloLink.OperationContext>>
    | Partial<ApolloLink.OperationContext>;

  /**
   * @deprecated
   * Use `ContextSetter` instead. This type is used by the deprecated
   * `setContext` function.
   */
  export type LegacyContextSetter = (
    operation: SetContextLink.SetContextOperation,
    prevContext: Readonly<ApolloLink.OperationContext>
  ) =>
    | Promise<Partial<ApolloLink.OperationContext>>
    | Partial<ApolloLink.OperationContext>;

  /**
   * An `ApolloLink.Operation` object without the `getContext` and `setContext`
   * methods. This prevents context setters from directly manipulating the
   * context during the setter function execution.
   */
  export type SetContextOperation = Omit<
    ApolloLink.Operation,
    "getContext" | "setContext"
  >;
}

/**
 * @deprecated
 * Use `SetContextLink` from `@apollo/client/link/context` instead. Note you
 * will need to flip the arguments when using `SetContextLink` as `prevContext`
 * is the first argument.
 *
 * ```ts
 * new SetContextLink((prevContext, operation) => {
 *   // ...
 * });
 * ```
 */
export function setContext(setter: SetContextLink.LegacyContextSetter) {
  return new SetContextLink((prevContext, operation) =>
    setter(operation, prevContext)
  );
}
/**
 * `SetContextLink` is a non-terminating link that allows you to modify the
 * context of GraphQL operations before they're passed to the next link in the
 * chain. This is commonly used for authentication, adding headers, and other
 * request-time configuration.
 *
 * @example
 *
 * ```ts
 * import { SetContextLink } from "@apollo/client/link/context";
 *
 * const link = new SetContextLink((prevContext, operation) => {
 *   return {
 *     credentials: "include",
 *     // ...
 *   };
 * });
 * ```
 */
export class SetContextLink extends ApolloLink {
  constructor(setter: SetContextLink.ContextSetter) {
    super((operation, forward) => {
      const { ...request } = operation as SetContextLink.SetContextOperation;

      Object.defineProperty(request, "client", {
        enumerable: false,
        value: operation.client,
      });

      return new Observable((observer) => {
        let closed = false;
        Promise.resolve(request)
          .then((req) => setter(operation.getContext(), req))
          .then(operation.setContext)
          .then(() => {
            if (!closed) {
              forward(operation).subscribe(observer);
            }
          })
          .catch(observer.error.bind(observer));

        return () => {
          closed = true;
        };
      });
    });
  }
}
