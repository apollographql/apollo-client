import type { Subscription } from "rxjs";
import { Observable } from "rxjs";

import type { GraphQLRequest, OperationContext } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";

export type ContextSetter = (
  operation: GraphQLRequest,
  prevContext: OperationContext
) => Promise<Partial<OperationContext>> | Partial<OperationContext>;

/**
 * @deprecated
 * Use `SetContextLink` from `@apollo/client/link/context` instead.
 */
export function setContext(setter: ContextSetter) {
  return new SetContextLink(setter);
}
export class SetContextLink extends ApolloLink {
  constructor(setter: ContextSetter) {
    super((operation, forward) => {
      const { ...request } = operation;

      return new Observable((observer) => {
        let handle: Subscription;
        let closed = false;
        Promise.resolve(request)
          .then((req) => setter(req, operation.getContext()))
          .then(operation.setContext)
          .then(() => {
            // if the observer is already closed, no need to subscribe.
            if (closed) return;
            handle = forward(operation).subscribe({
              next: observer.next.bind(observer),
              error: observer.error.bind(observer),
              complete: observer.complete.bind(observer),
            });
          })
          .catch(observer.error.bind(observer));

        return () => {
          closed = true;
          if (handle) handle.unsubscribe();
        };
      });
    });
  }
}
