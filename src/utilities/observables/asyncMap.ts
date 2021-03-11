import { Observable, Observer } from "./Observable";

// Like Observable.prototype.map, except that the mapping function can
// optionally return a Promise (or be async).
export function asyncMap<V, R>(
  observable: Observable<V>,
  mapFn: (value: V) => R | PromiseLike<R>,
  catchFn?: (error: any) => R | PromiseLike<R>,
): Observable<R> {
  return new Observable<R>(observer => {
    const { next, error, complete } = observer;
    let activeCallbackCount = 0;
    let completed = false;
    let promiseQueue = {
      // Normally we would initialize promiseQueue to Promise.resolve(), but
      // in this case, for backwards compatibility, we need to be careful to
      // invoke the first callback synchronously.
      then(callback: () => any) {
        return new Promise(resolve => resolve(callback()));
      },
    } as Promise<void>;

    function makeCallback(
      examiner: typeof mapFn | typeof catchFn,
      delegate: typeof next | typeof error,
    ): (arg: any) => void {
      if (examiner) {
        return arg => {
          ++activeCallbackCount;
          const both = () => examiner(arg);
          promiseQueue = promiseQueue.then(both, both).then(
            result => {
              --activeCallbackCount;
              next && next.call(observer, result);
              if (completed) {
                handler.complete!();
              }
            },
            error => {
              --activeCallbackCount;
              throw error;
            },
          ).catch(caught => {
            error && error.call(observer, caught);
          });
        };
      } else {
        return arg => delegate && delegate.call(observer, arg);
      }
    }

    const handler: Observer<V> = {
      next: makeCallback(mapFn, next),
      error: makeCallback(catchFn, error),
      complete() {
        completed = true;
        if (!activeCallbackCount) {
          complete && complete.call(observer);
        }
      },
    };

    const sub = observable.subscribe(handler);
    return () => sub.unsubscribe();
  });
}
