import { invariant } from "../../utilities/globals/index.js";
import type { Observable } from "../../utilities/index.js";

/**
 * @deprecated `toPromise` will be removed in Apollo Client 4.0. This is safe
 * to use in 3.x.
 *
 * **Recommended now**
 *
 * No action needed
 *
 * **When upgrading**
 *
 * Use RxJS's [`firstValueFrom`](https://rxjs.dev/api/index/function/firstValueFrom) function.
 *
 * ```ts
 * const result = await firstValueFrom(observable);
 * ```
 */
export function toPromise<R>(observable: Observable<R>): Promise<R> {
  let completed = false;
  return new Promise<R>((resolve, reject) => {
    observable.subscribe({
      next: (data) => {
        if (completed) {
          invariant.warn(
            `Promise Wrapper does not support multiple results from Observable`
          );
        } else {
          completed = true;
          resolve(data);
        }
      },
      error: reject,
    });
  });
}
