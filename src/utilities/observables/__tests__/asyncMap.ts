import { itAsync } from "../../testing";
import { Observable } from "../Observable";
import { asyncMap } from "../asyncMap";

const wait = (delayMs: number) =>
  new Promise<void>(resolve => setTimeout(resolve, delayMs));

function make1234Observable() {
  return new Observable<number>(observer => {
    observer.next(1);
    observer.next(2);
    setTimeout(() => {
      observer.next(3);
      setTimeout(() => {
        observer.next(4);
        observer.complete();
      }, 10);
    }, 10);
  });
}

function rejectExceptions<Args extends any[], Ret>(
  reject: (reason: any) => any,
  fn: (...args: Args) => Ret,
) {
  return function () {
    try {
      return fn.apply(this, arguments);
    } catch (error) {
      reject(error);
    }
  } as typeof fn;
}

describe("asyncMap", () => {
  itAsync("keeps normal results in order", (resolve, reject) => {
    const values: number[] = [];
    const mapped: number[] = [];

    asyncMap(make1234Observable(), value => {
      values.push(value);
      // Make earlier results take longer than later results.
      const delay = 100 - value * 10;
      return wait(delay).then(() => value * 2);
    }).subscribe({
      next(mappedValue) {
        mapped.push(mappedValue);
      },
      error: reject,
      complete: rejectExceptions(reject, () => {
        expect(values).toEqual([1, 2, 3, 4]);
        expect(mapped).toEqual([2, 4, 6, 8]);
        resolve();
      }),
    });
  });
});
