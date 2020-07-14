import { ApolloLink } from '../core/ApolloLink';
import { Operation, GraphQLRequest } from '../core/types';
import { Observable } from '../../utilities/observables/Observable';
import { NextLink } from '../core/types';

export type ContextSetter = (
  operation: GraphQLRequest,
  prevContext: any,
) => Promise<any> | any;

export function setContext(setter: ContextSetter): ApolloLink {
  return new ApolloLink((operation: Operation, forward: NextLink) => {
    const { ...request } = operation;

    return new Observable(observer => {
      let handle: ZenObservable.Subscription;
      Promise.resolve(request)
        .then(req => setter(req, operation.getContext()))
        .then(operation.setContext)
        .then(() => {
          handle = forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer),
          });
        })
        .catch(observer.error.bind(observer));

      return () => {
        if (handle) handle.unsubscribe();
      };
    });
  });
}
