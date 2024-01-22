import { invariant } from "../../utilities/globals/index.js";
import type { Observable } from "../../utilities/index.js";

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
