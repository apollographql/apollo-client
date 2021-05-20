import { Observable } from "./Observable";

/**
 * Maps a potentially async function over the observable. An errorFn may also
 * be passed, causing .
 */
export function asyncMap<V, R>(
  observable: Observable<V>,
  mapFn: (value: V) => R | PromiseLike<R>,
  errorFn?: (error: any) => R | PromiseLike<R>,
): Observable<R> {
  return new Observable<R>(observer => {
    let completed = false;
    let pending: Promise<unknown> | undefined;
    let pendingCount = 0;
    function makeCallback(
      fn: ((arg: unknown) => R | PromiseLike<R>) | undefined,
      delegate: (arg: unknown) => void,
    ): (arg: any) => void {
      if (!fn) {
        return delegate;
      }

      return arg => {
        pendingCount++;
        pending = (
          pending
          ? pending.then(() => fn(arg))
          : new Promise((resolve) => resolve(fn(arg)))
        ).then(
          result => {
            pendingCount--;
            delegate(result);
            if (completed && pendingCount <= 0) {
              observer.complete();
            }
          },
          err => {
            pendingCount--;
            observer.error(err);
          },
        );
      };
    }

    const sub = observable.subscribe(
      makeCallback(mapFn, observer.next.bind(observer)),
      makeCallback(errorFn, observer.error.bind(observer)),
      () => {
        completed = true;
        if (pendingCount <= 0) {
          observer.complete();
        }
      },
    );

    return () => sub.unsubscribe();
  });
}
