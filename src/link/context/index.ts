import type { Subscription } from "rxjs";
import { Observable } from "rxjs";

import type { DefaultContext } from "@apollo/client";
import type { GraphQLRequest } from "@apollo/client/link/core";
import { ApolloLink } from "@apollo/client/link/core";

export type ContextSetter = (
  operation: GraphQLRequest,
  prevContext: DefaultContext
) => Promise<DefaultContext> | DefaultContext;

export function setContext(setter: ContextSetter): ApolloLink {
  return new ApolloLink((operation, forward) => {
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
