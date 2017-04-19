import { ObservableQuery } from '../../src/core/ObservableQuery';
import { ApolloQueryResult } from '../../src/core/types';
import { Subscription } from '../../src/util/Observable';

import wrap from './wrap';

export default function subscribeAndCount(done: MochaDone, observable: ObservableQuery<any>,
    cb: (handleCount: number, result: ApolloQueryResult<any>) => any): Subscription {
  let handleCount = 0;
  const subscription = observable.subscribe({
    next: result => {
      try {
        handleCount++;
        cb(handleCount, result);
      } catch (e) {
        // Wrap in a `setImmediate` so that we will unsubscribe on the next
        // tick so that we can make sure that the `subscription` has a chance
        // to be defined.
        setImmediate(() => {
          subscription.unsubscribe();
          done(e);
        });
      }
    },
    error: done,
  });
  return subscription;
}
