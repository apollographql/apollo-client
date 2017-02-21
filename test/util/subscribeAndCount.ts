import { ObservableQuery } from '../../src/core/ObservableQuery';
import { ApolloQueryResult } from '../../src/core/types';
import { Subscription } from '../../src/util/Observable';

import wrap from './wrap';

export default function(done: MochaDone, observable: ObservableQuery<any>,
    cb: (handleCount: number, result: ApolloQueryResult<any>) => any): Subscription {
  let handleCount = 0;
  const subscription = observable.subscribe({
    next: result => {
      try {
        handleCount++;
        cb(handleCount, result);
      } catch (e) {
        subscription.unsubscribe();
        done(e);
      }
    },
    error: done,
  });
  return subscription;
};
