import type { OperatorFunction } from "rxjs";
import { Observable } from "rxjs";

export function filterMap<T, R>(
  fn: (value: T, context: undefined) => R | undefined
): OperatorFunction<T, R>;
export function filterMap<T, R, Context>(
  fn: (value: T, context: Context) => R | undefined,
  makeContext: () => NoInfer<Context>
): OperatorFunction<T, R>;
export function filterMap<T, R>(
  fn: (value: T, context: any) => R | undefined,
  makeContext = () => undefined
): OperatorFunction<T, R> {
  return (source) =>
    new Observable<R>((subscriber) => {
      let context = makeContext();
      return source.subscribe({
        next(value) {
          let result: R | undefined;
          try {
            result = fn(value, context);
          } catch (e) {
            subscriber.error(e);
          }
          if (result === undefined) {
            return;
          }
          subscriber.next(result);
        },
        error(err) {
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });
    });
}
