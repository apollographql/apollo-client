import { Observable } from '../../utilities/observables/Observable';

export function fromError<T>(errorValue: any): Observable<T> {
  return new Observable<T>(observer => {
    observer.error(errorValue);
  });
}
