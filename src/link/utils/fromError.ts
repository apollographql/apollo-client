import Observable from 'zen-observable';

export function fromError<T>(errorValue: any): Observable<T> {
  return new Observable<T>(observer => {
    observer.error(errorValue);
  });
}
