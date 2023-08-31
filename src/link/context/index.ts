import type { Operation, GraphQLRequest, NextLink } from "../core/index.js";
import { ApolloLink } from "../core/index.js";
import type { ObservableSubscription } from "../../utilities/index.js";
import { Observable } from "../../utilities/index.js";
import type { DefaultContext } from "../../core/index.js";

export type ContextSetter = (
  operation: GraphQLRequest,
  prevContext: DefaultContext
) => Promise<DefaultContext> | DefaultContext;

export function setContext(setter: ContextSetter): ApolloLink {
  return new ApolloLink((operation: Operation, forward: NextLink) => {
    const { ...request } = operation;

    return new Observable((observer) => {
      let handle: ObservableSubscription;
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
