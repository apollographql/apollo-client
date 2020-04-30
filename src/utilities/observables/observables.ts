import { Observable, Observer } from "./Observable";
import { Concast } from "./Concast";

export function multicast<T>(...sources: Observable<T>[]) {
  return new Concast(sources);
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

export function iterateObserversSafely<E, A>(
  observers: Set<Observer<E>>,
  method: keyof Observer<E>,
  argument?: A,
) {
  // In case observers is modified during iteration, we need to commit to the
  // original elements, which also provides an opportunity to filter them down
  // to just the observers with the given method.
  const observersWithMethod: Observer<E>[] = [];
  observers.forEach(obs => obs[method] && observersWithMethod.push(obs));
  observersWithMethod.forEach(obs => (obs as any)[method](argument));
}
