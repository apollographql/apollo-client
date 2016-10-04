import { ObservableQuery } from '../../src/core/ObservableQuery';
import { ApolloQueryResult } from '../../src/core/QueryManager';

// Take an observable and N callbacks, and observe the observable,
// ensuring it is called exactly N times, resolving once it has done so.
// Optionally takes a timeout, which it will wait X ms after the Nth callback
// to ensure it is not called again.
export default function(
  { observable, wait = 0 }: { observable: ObservableQuery, wait?: number },
    ...cbs: ((result: ApolloQueryResult) => any)[]): Promise<any[]> {
  let cbIndex = 0;
  const results: any[] = [];
  return new Promise((resolve, reject) => {
    const subscription = observable.subscribe({
      next(result) {
        const cb = cbs[cbIndex++];
        if (cb) {
          try {
            results.push(cb(result));
          } catch (e) {
            return reject(e);
          }

          if (cbIndex === cbs.length) {
            subscription.unsubscribe();

            if (wait === 0) {
              resolve(results);
            } else {
              setTimeout(() => resolve(results), wait);
            }
          }
        } else {
          reject(new Error(`Observable called more than ${cbs.length} times`));
        }
      },
      error: reject,
    });
  });
};
