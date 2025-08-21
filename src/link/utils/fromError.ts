import { Observable } from "../../utilities/index.js";

/**
 * @deprecated `fromError` will be removed in Apollo Client 4.0. This is safe
 * to use in 3.x.
 *
 * **Recommended now**
 *
 * No action needed
 *
 * **When upgrading**
 *
 * Use RxJS's [`throwError`](https://rxjs.dev/api/index/function/throwError) function.
 *
 * ```ts
 * const observable = throwError(() => new Error(...));
 * ```
 */
export function fromError<T>(errorValue: any): Observable<T> {
  return new Observable<T>((observer) => {
    observer.error(errorValue);
  });
}
