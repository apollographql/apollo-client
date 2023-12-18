import type { Observer } from "./Observable.js";
import { Observable } from "./Observable.js";

// Like Observable.prototype.map, except that the mapping function can
// optionally return a Promise (or be async).
export function asyncMap<V, R>(
  observable: Observable<V>,
  mapFn: (value: V) => R | PromiseLike<R>,
  catchFn?: (error: any) => R | PromiseLike<R>
): Observable<R> {
  return new Observable<R>((observer) => {
    let promiseQueue = {
      // Normally we would initialize promiseQueue to Promise.resolve(), but
      // in this case, for backwards compatibility, we need to be careful to
      // invoke the first callback synchronously.
      then(callback: () => any) {
        return new Promise((resolve) => resolve(callback()));
      },
    } as Promise<void>;

    function makeCallback(
      examiner: typeof mapFn | typeof catchFn,
      key: "next" | "error"
    ): (arg: any) => void {
      return (arg) => {
        if (examiner) {
          const both = () =>
            // If the observer is closed, we don't want to continue calling the
            // mapping function - it's result will be swallowed anyways.
            observer.closed ?
              /* will be swallowed */ (0 as any)
            : examiner(arg);

          promiseQueue = promiseQueue.then(both, both).then(
            (result) => observer.next(result),
            (error) => observer.error(error)
          );
        } else {
          observer[key](arg);
        }
      };
    }

    const handler: Observer<V> = {
      next: makeCallback(mapFn, "next"),
      error: makeCallback(catchFn, "error"),
      complete() {
        // no need to reassign `promiseQueue`, after `observer.complete`,
        // the observer will be closed and short-circuit everything anyways
        /*promiseQueue = */ promiseQueue.then(() => observer.complete());
      },
    };

    const sub = observable.subscribe(handler);
    return () => sub.unsubscribe();
  });
}
