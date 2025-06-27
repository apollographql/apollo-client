import { Observable } from "rxjs";

import type { Operation, OperationContext } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";

export declare namespace SetContextLink {
  export type ContextSetter = (
    prevContext: OperationContext,
    operation: SetContextOperation
  ) => Promise<Partial<OperationContext>> | Partial<OperationContext>;

  export type LegacyContextSetter = (
    operation: SetContextOperation,
    prevContext: OperationContext
  ) => Promise<Partial<OperationContext>> | Partial<OperationContext>;

  export type SetContextOperation = Omit<
    Operation,
    "getContext" | "setContext"
  >;
}

/**
 * @deprecated
 * Use `SetContextLink` from `@apollo/client/link/context` instead.
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
