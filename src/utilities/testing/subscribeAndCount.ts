import { ObservableQuery } from '../../core/ObservableQuery';
import { ApolloQueryResult } from '../../core/types';
import { Subscription } from '../../utilities/observables/Observable';
import { asyncMap } from '../../utilities/observables/observables';

export default function subscribeAndCount(
  reject: (reason: any) => any,
  observable: ObservableQuery<any>,
  cb: (handleCount: number, result: ApolloQueryResult<any>) => any,
): Subscription {
  let handleCount = 0;
  const subscription = asyncMap(
    observable,
    (result: ApolloQueryResult<any>) => {
      try {
        return cb(++handleCount, result);
      } catch (e) {
        // Wrap in a `setImmediate` so that we will unsubscribe on the next
        // tick so that we can make sure that the `subscription` has a chance
        // to be defined.
        setImmediate(() => {
          subscription.unsubscribe();
          reject(e);
        });
      }
    },
  ).subscribe({
    error: reject,
  });
  return subscription;
}
