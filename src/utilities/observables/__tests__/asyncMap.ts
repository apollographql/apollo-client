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

  itAsync("handles exceptions from mapping functions", (resolve, reject) => {
    const triples: number[] = [];
    asyncMap(make1234Observable(), num => {
      if (num === 3) throw new Error("expected");
      return num * 3;
    }).subscribe({
      next: rejectExceptions(reject, triple => {
        expect(triple).toBeLessThan(9);
        triples.push(triple);
      }),
      error: rejectExceptions(reject, error => {
        expect(error.message).toBe("expected");
        expect(triples).toEqual([3, 6]);
        resolve();
      }),
    });
  });

  itAsync("handles rejected promises from mapping functions", (resolve, reject) => {
    const triples: number[] = [];
    asyncMap(make1234Observable(), num => {
      if (num === 3) return Promise.reject(new Error("expected"));
      return num * 3;
    }).subscribe({
      next: rejectExceptions(reject, triple => {
        expect(triple).toBeLessThan(9);
        triples.push(triple);
      }),
      error: rejectExceptions(reject, error => {
        expect(error.message).toBe("expected");
        expect(triples).toEqual([3, 6]);
        resolve();
      }),
    });
  });

  itAsync("handles async exceptions from mapping functions", (resolve, reject) => {
    const triples: number[] = [];
    asyncMap(make1234Observable(), num => wait(10).then(() => {
      if (num === 3) throw new Error("expected");
      return num * 3;
    })).subscribe({
      next: rejectExceptions(reject, triple => {
        expect(triple).toBeLessThan(9);
        triples.push(triple);
      }),
      error: rejectExceptions(reject, error => {
        expect(error.message).toBe("expected");
        expect(triples).toEqual([3, 6]);
        resolve();
      }),
    });
  });

  itAsync("handles exceptions from next functions", (resolve, reject) => {
    const triples: number[] = [];
    asyncMap(make1234Observable(), num => {
      return num * 3;
    }).subscribe({
      next(triple) {
        triples.push(triple);
        // Unfortunately this exception won't be caught by asyncMap, because
        // the Observable implementation wraps this next function with its own
        // try-catch. Uncomment the remaining lines to make this test more
        // meaningful, in the event that this behavior ever changes.
        // if (triple === 9) throw new Error("expected");
      },
      // error: rejectExceptions(reject, error => {
      //   expect(error.message).toBe("expected");
      //   expect(triples).toEqual([3, 6, 9]);
      //   resolve();
      // }),
      complete: rejectExceptions(reject, () => {
        expect(triples).toEqual([3, 6, 9, 12]);
        resolve();
      }),
    });
  });
});
