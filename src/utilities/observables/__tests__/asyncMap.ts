import { Observable } from "rxjs";
import { asyncMap } from "../asyncMap";
import { ObservableStream } from "../../../testing/internal";
const wait = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

function make1234Observable() {
  return new Observable<number>((observer) => {
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

describe("asyncMap", () => {
  it("keeps normal results in order", async () => {
    const values: number[] = [];

    const observable = asyncMap(make1234Observable(), (value) => {
      values.push(value);
      // Make earlier results take longer than later results.
      const delay = 100 - value * 10;
      return wait(delay).then(() => value * 2);
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue(2);
    await expect(stream).toEmitValue(4);
    await expect(stream).toEmitValue(6);
    await expect(stream).toEmitValue(8);
    await expect(stream).toComplete();

    expect(values).toEqual([1, 2, 3, 4]);
  });

  it("handles exceptions from mapping functions", async () => {
    const observable = asyncMap(make1234Observable(), (num) => {
      if (num === 3) throw new Error("expected");
      return num * 3;
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue(3);
    await expect(stream).toEmitValue(6);
    await expect(stream).toEmitError(new Error("expected"));
  });

  it("handles rejected promises from mapping functions", async () => {
    const observable = asyncMap(make1234Observable(), (num) => {
      if (num === 3) return Promise.reject(new Error("expected"));
      return num * 3;
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue(3);
    await expect(stream).toEmitValue(6);
    await expect(stream).toEmitError(new Error("expected"));
  });

  it("handles async exceptions from mapping functions", async () => {
    const observable = asyncMap(make1234Observable(), (num) =>
      wait(10).then(() => {
        if (num === 3) throw new Error("expected");
        return num * 3;
      })
    );
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue(3);
    await expect(stream).toEmitValue(6);
    await expect(stream).toEmitError(new Error("expected"));
  });

  it("handles exceptions from next functions", (done) => {
    const triples: number[] = [];
    asyncMap(make1234Observable(), (num) => {
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
      complete: () => {
        expect(triples).toEqual([3, 6, 9, 12]);
        done();
      },
    });
  });

  test.each([
    ["sync", (n: number) => n * 2],
    ["async", async (n: number) => n * 2],
  ])("[%s] mapFn maps over values", async (_, mapFn) => {
    const observable = new Observable<number>((observer) => {
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
    const mapped = asyncMap(observable, mapFn);
    const stream = new ObservableStream(mapped);
    await expect(stream.takeNext()).resolves.toBe(2);
    await expect(stream.takeNext()).resolves.toBe(4);
    await expect(stream.takeNext()).resolves.toBe(6);
    await expect(stream.takeNext()).resolves.toBe(8);
    await stream.takeComplete();
  });

  test.each([["sync"], ["async"]])(
    "[%s] mapFn notifies the observer with an error when an error is thrown inside the mapFn",
    async (synchronity) => {
      const observable = new Observable<number>((observer) => {
        observer.next(1);
        observer.next(2);
        setTimeout(() => {
          // this will throw
          observer.next(3);
          // this will be swallowed and also not call `mapFn` anymore
          observer.next(4);
          setTimeout(() => {
            observer.next(5);
            observer.complete();
          }, 10);
        }, 10);
      });
      let lastMapped = 0;
      const mapped = asyncMap(
        observable,
        synchronity === "sync" ?
          (n: number) => {
            lastMapped = n;
            if (n === 3) throw new Error("expected");
            return n * 2;
          }
        : async (n: number) => {
            lastMapped = n;
            if (n === 3) throw new Error("expected");
            return n * 2;
          }
      );
      const stream = new ObservableStream(mapped);
      await expect(stream.takeNext()).resolves.toBe(2);
      await expect(stream.takeNext()).resolves.toBe(4);
      await expect(stream.takeError()).resolves.toEqual(new Error("expected"));
      // no more emits
      expect(stream.take()).rejects.toMatch(/timeout/i);
      // the observer was closed after the error, so we don't expect `mapFn` to
      // be called for values that will not be emitted
      expect(lastMapped).toBe(3);
    }
  );

  test.each([
    ["sync", () => 99],
    ["async", async () => 99],
  ])(
    "[%s] catchFn notifies the observer with a value when `catchFn` returns a value instead of re-throwing",
    async (_, catchFn) => {
      const observable = new Observable<number>((observer) => {
        observer.next(1);
        observer.next(2);
        setTimeout(() => {
          observer.error(new Error("expected"));
          // will be ignored by parent Observable since the observer already closed
          observer.next(4);
        }, 10);
      });
      const mapped = asyncMap(observable, (n) => n * 2, catchFn);
      const stream = new ObservableStream(mapped);
      await expect(stream.takeNext()).resolves.toBe(2);
      await expect(stream.takeNext()).resolves.toBe(4);
      await expect(stream.takeNext()).resolves.toBe(99);
      // even after recovery, further `.next` inside the observer will be ignored
      // by the parent Observable itself, so asyncMap cannot do anything about that
      expect(stream.take()).rejects.toMatch(/timeout/i);
    }
  );

  test.each([
    // prettier-ignore
    ["sync", () => { throw new Error("another error") }],
    // prettier-ignore
    ["async", async () => { throw new Error("another error") }],
  ])("[%s] catchFn can map one error to another error", async (_, catchFn) => {
    const observable = new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      setTimeout(() => {
        observer.error(new Error("expected"));
        // will be ignored by Observable since the observer already closed
        observer.next(4);
      }, 10);
    });
    const mapped = asyncMap(observable, (n) => n * 2, catchFn);
    const stream = new ObservableStream(mapped);
    await expect(stream.takeNext()).resolves.toBe(2);
    await expect(stream.takeNext()).resolves.toBe(4);
    await expect(stream.takeError()).resolves.toEqual(
      new Error("another error")
    );
    // even after recovery, further `.next` inside the observer will be ignored
    // by the Observable itself, so asyncMap cannot do anything about that
    expect(stream.take()).rejects.toMatch(/timeout/i);
  });
});
