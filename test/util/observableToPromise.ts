import { ObservableQuery } from '../../src/core/ObservableQuery';
import { ApolloQueryResult } from '../../src/core/QueryManager';

// Take an observable and N callbacks, and observe the observable,
// ensuring it is called exactly N times, resolving once it has done so.
// Optionally takes a timeout, which it will wait X ms after the Nth callback
// to ensure it is not called again.
export default function({
      observable,
      wait = -1,
      errorCallbacks = [],
    }: {
      observable: ObservableQuery,
      wait?: number,
      errorCallbacks?: ((error: Error) => any)[],
    },
    ...cbs: ((result: ApolloQueryResult) => any)[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    let errorIndex = 0;
    let cbIndex = 0;
    const results: any[] = [];

    let subscription: any;

    function tryToResolve() {
      if (cbIndex === cbs.length && errorIndex === errorCallbacks.length) {
        subscription.unsubscribe();

        if (wait === -1) {
          resolve(results);
        } else {
          setTimeout(() => resolve(results), wait);
        }
      }
    }

    subscription = observable.subscribe({
      next(result) {
        const cb = cbs[cbIndex++];
        if (cb) {
          try {
            results.push(cb(result));
          } catch (e) {
            return reject(e);
          }
          tryToResolve();
        } else {
          reject(new Error(`Observable called more than ${cbs.length} times`));
        }
      },
      error(error) {
        const errorCb = errorCallbacks[errorIndex++];
        if (errorCb) {
          try {
            // XXX: should we collect these results too?
            errorCb(error);
          } catch (e) {
            return reject(e);
          }
          tryToResolve();
        } else {
          reject(error);
        }
      },
    });
  });
};
