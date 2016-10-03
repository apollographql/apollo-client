import { ObservableQuery } from '../../src/core/ObservableQuery';
import { ApolloQueryResult } from '../../src/core/QueryManager';
import { Subscription } from '../../src/util/Observable';

import wrap from './wrap';

export default function(done: Function, observable: ObservableQuery,
    cb: (handleCount: Number, result: ApolloQueryResult) => any): Subscription {
  let handleCount = 0;
  return observable.subscribe({
    next: wrap(done, result => {
      handleCount++;
      cb(handleCount, result);
    }),
  });
};
