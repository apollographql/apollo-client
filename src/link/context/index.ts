import { Observable } from "rxjs";

import { ApolloLink } from "@apollo/client/link";

export declare namespace SetContextLink {
  export type ContextSetter = (
    prevContext: ApolloLink.OperationContext,
    operation: SetContextOperation
  ) =>
    | Promise<Partial<ApolloLink.OperationContext>>
    | Partial<ApolloLink.OperationContext>;

  export type LegacyContextSetter = (
    operation: SetContextOperation,
    prevContext: ApolloLink.OperationContext
  ) =>
    | Promise<Partial<ApolloLink.OperationContext>>
    | Partial<ApolloLink.OperationContext>;

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
