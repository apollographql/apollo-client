import { Observable, Observer, ObservableSubscription } from './Observable';

// Returns a normal Observable that can have any number of subscribers,
// while ensuring the original Observable gets subscribed to at most once.
export function multiplex<T>(inner: Observable<T>): Observable<T> {
  const observers = new Set<Observer<T>>();
  let sub: ObservableSubscription | null = null;
  return new Observable<T>(observer => {
    observers.add(observer);
    sub = sub || inner.subscribe({
      next(value) {
        observers.forEach(obs => obs.next && obs.next(value));
      },
      error(error) {
        observers.forEach(obs => obs.error && obs.error(error));
      },
      complete() {
        observers.forEach(obs => obs.complete && obs.complete());
      },
    });
    return () => {
      if (observers.delete(observer) && !observers.size && sub) {
        sub.unsubscribe();
        sub = null;
      }
    };
  });
}

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

    function makeCallback(
      examiner: typeof mapFn | typeof catchFn,
      delegate: typeof next | typeof error,
    ): (arg: any) => void {
      if (examiner) {
        return arg => {
          ++activeCallbackCount;
          new Promise(resolve => resolve(examiner(arg))).then(
            result => {
              --activeCallbackCount;
              next && next.call(observer, result);
              if (completed) {
                handler.complete!();
              }
            },
            e => {
              --activeCallbackCount;
              error && error.call(observer, e);
            },
          );
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
