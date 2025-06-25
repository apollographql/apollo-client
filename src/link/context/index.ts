import type { Subscription } from "rxjs";
import { Observable } from "rxjs";

import type { Operation, OperationContext } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";

export declare namespace SetContextLink {
  export type ContextSetter = (
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
export function setContext(setter: SetContextLink.ContextSetter) {
  return new SetContextLink(setter);
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
        let handle: Subscription | undefined;
        let closed = false;
        Promise.resolve(request)
          .then((req) => setter(req, operation.getContext()))
          .then(operation.setContext)
          .then(() => {
            // if the observer is already closed, no need to subscribe.
            if (closed) return;
            handle = forward(operation).subscribe(observer);
          })
          .catch(observer.error.bind(observer));

        return () => {
          closed = true;
          handle?.unsubscribe();
        };
      });
    });
  }
}
