import { Observable } from '../../utilities/observables/Observable';

export function fromPromise<T>(promise: Promise<T>): Observable<T> {
  return new Observable<T>(observer => {
    promise
      .then((value: T) => {
        observer.next(value);
        observer.complete();
      })
      .catch(observer.error.bind(observer));
  });
}
