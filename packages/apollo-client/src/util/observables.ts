import { Observable, Observer, Subscription } from './Observable';

// Returns a normal Observable that can have any number of subscribers,
// while ensuring the original Observable gets subscribed to at most once.
export function multiplex<T>(inner: Observable<T>): Observable<T> {
  const observers = new Set<Observer<T>>();
  let sub: Subscription | null = null;
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
