import type { Observable, OperatorFunction } from "rxjs";
import { pipe } from "rxjs";

export function pipeWithOwnProps<T, R>(fn: OperatorFunction<T, R>) {
  return (observable: Observable<T>): Observable<R> => {
    const result = pipe(fn)(observable) as any;
    for (const prop of Object.getOwnPropertyNames(observable)) {
      result[prop] = (observable as any)[prop];
    }
    return result;
  };
}
