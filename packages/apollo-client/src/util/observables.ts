import { Observable, Observer } from './Observable';

export function afterAllUnsubscribed<T>(
  inner: Observable<T>,
  cleanup: () => any,
): Observable<T> {
  const observers = new Set<Observer<T>>();
  return new Observable<T>(observer => {
    observers.add(observer);
    const sub = inner.subscribe(observer);
    return () => {
      sub.unsubscribe();
      if (observers.delete(observer) && !observers.size) {
        cleanup();
      }
    };
  });
}

// Like Observable.prototype.map, except that the mapping function can
// optionally return a Promise (or be async).
export function asyncMap<V, R>(
  observable: Observable<V>,
  mapFn: (value: V) => R | Promise<R>,
): Observable<R> {
  return new Observable<R>(observer => {
    const { next, error, complete } = observer;
    let activeNextCount = 0;
    let completed = false;

    const handler: Observer<V> = {
      next(value) {
        ++activeNextCount;
        new Promise(resolve => {
          resolve(mapFn(value));
        }).then(
          result => {
            --activeNextCount;
            next && next.call(observer, result);
            completed && handler.complete!();
          },
          e => {
            --activeNextCount;
            error && error.call(observer, e);
          },
        );
      },
      error(e) {
        error && error.call(observer, e);
      },
      complete() {
        completed = true;
        if (!activeNextCount) {
          complete && complete.call(observer);
        }
      },
    };

    const sub = observable.subscribe(handler);
    return () => sub.unsubscribe();
  });
}
