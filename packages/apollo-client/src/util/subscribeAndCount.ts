import { ObservableQuery } from '../../src/core/ObservableQuery';
import { ApolloQueryResult } from '../../src/core/types';
import { Subscription } from '../../src/util/Observable';

export default function subscribeAndCount(
  done: jest.DoneCallback,
  observable: ObservableQuery<any>,
  cb: (handleCount: number, result: ApolloQueryResult<any>) => any,
): Subscription {
  let handleCount = 0;
  const subscription = observable.subscribe({
    next(result: ApolloQueryResult<any>) {
      try {
        handleCount++;
        cb(handleCount, result);
      } catch (e) {
        // Wrap in a `setImmediate` so that we will unsubscribe on the next
        // tick so that we can make sure that the `subscription` has a chance
        // to be defined.
        setImmediate(() => {
          subscription.unsubscribe();
          done.fail(e);
        });
      }
    },
    error: done.fail,
  });
  return subscription;
}
