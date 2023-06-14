import { Observable } from "zen-observable-ts";

export function zenObservableToPromiseFirstValue<T>(observable: Observable<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const subscription = observable.subscribe({
      next(value) {
        resolve(value);
        subscription.unsubscribe();
      },
      error(error) {
        reject(error);
      },
    });
  });
}

export function zenObservableToPromiseAll<T>(observable: Observable<T>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const values: T[] = [];
    observable.subscribe({
      next(value) {
        values.push(value);
      },
      complete() {
        resolve(values);
      },
      error(error) {
        reject(error);
      },
    });
  });
}
