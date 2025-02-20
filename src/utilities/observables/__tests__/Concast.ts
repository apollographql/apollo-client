import { Observable, Observer } from "../Observable.js";
import { Concast, ConcastSourcesIterable } from "../Concast.js";
import { ObservableStream } from "../../../testing/internal/index.js";

describe("Concast Observable (similar to Behavior Subject in RxJS)", () => {
  it("can concatenate other observables", async () => {
    const concast = new Concast([
      Observable.of(1, 2, 3),
      Promise.resolve(Observable.of(4, 5)),
      Observable.of(6, 7, 8, 9),
      Promise.resolve().then(() => Observable.of(10)),
      Observable.of(11),
    ]);

    const stream = new ObservableStream(concast);

    await expect(stream).toEmitValue(1);
    await expect(stream).toEmitValue(2);
    await expect(stream).toEmitValue(3);
    await expect(stream).toEmitValue(4);
    await expect(stream).toEmitValue(5);
    await expect(stream).toEmitValue(6);
    await expect(stream).toEmitValue(7);
    await expect(stream).toEmitValue(8);
    await expect(stream).toEmitValue(9);
    await expect(stream).toEmitValue(10);
    await expect(stream).toEmitValue(11);
    await expect(stream).toComplete();

    const finalResult = await concast.promise;

    expect(finalResult).toBe(11);
  });

  it("Can tolerate being completed before input Promise resolves", async () => {
    let resolvePromise: (sources: ConcastSourcesIterable<number>) => void;
    const delayPromise = new Promise<ConcastSourcesIterable<number>>(
      (resolve) => {
        resolvePromise = resolve;
      }
    );

    const concast = new Concast<number>(delayPromise);
    const observer = {
      next() {
        throw new Error("should not have called observer.next");
      },
      error() {
        throw new Error("Should not have called observer.error");
      },
      complete() {
        throw new Error("should not have called observer.complete");
      },
    };

    concast.addObserver(observer);
    concast.removeObserver(observer);

    const finalResult = await concast.promise;
    expect(finalResult).toBeUndefined();

    resolvePromise!([]);
    const delayedPromiseResult = await delayPromise;

    expect(delayedPromiseResult).toEqual([]);
  });

  it("behaves appropriately if unsubscribed before first result", async () => {
    const concast = new Concast([
      new Promise((resolve) => setTimeout(resolve, 100)).then(() =>
        Observable.of(1, 2, 3)
      ),
    ]);

    const cleanupCounts = {
      first: 0,
      second: 0,
    };

    concast.beforeNext(() => {
      ++cleanupCounts.first;
    });
    const stream = new ObservableStream(concast);

    concast.beforeNext(() => {
      ++cleanupCounts.second;
    });

    // Immediately unsubscribe the observer we just added, triggering
    // completion.
    stream.unsubscribe();

    const finalResult = await concast.promise;

    expect(finalResult).toBeUndefined();
    expect(cleanupCounts).toEqual({
      first: 1,
      second: 1,
    });

    await expect(stream).not.toEmitAnything();
  });

  it("concast.beforeNext listeners run before next result/error", () => {
    const log: Array<number | [string, any?]> = [];
    let resolve7Promise: undefined | (() => void);

    const concast = new Concast([
      Observable.of(1, 2),

      new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
        enqueueListener();
        return Observable.of(3, 4);
      }),

      Observable.of(5, 6),

      new Promise<void>((resolve) => {
        resolve7Promise = resolve;
      }).then(() => {
        enqueueListener();
        return Observable.of(7);
      }),

      Observable.of(8, 9),
    ]);

    function enqueueListener() {
      concast.beforeNext((method, arg) => {
        log.push([method, arg]);
      });
    }

    const sub = concast.subscribe({
      next(num) {
        log.push(num);
        if (num === 6) {
          resolve7Promise!();
        } else if (num === 8) {
          enqueueListener();
          // Prevent delivery of final 9 result.
          sub.unsubscribe();
        }
      },
    });

    enqueueListener();

    return concast.promise.then((lastResult) => {
      expect(lastResult).toBe(8);

      expect(log).toEqual([
        ["next", 1],
        1,
        2,
        ["next", 3],
        3,
        4,
        5,
        6,
        ["next", 7],
        7,
        8,
        ["complete", void 0],
      ]);

      sub.unsubscribe();
    });
  });

  it("resolving all sources of a concast frees all observer references on `this.observers`", async () => {
    const { promise, resolve } = deferred<Observable<number>>();
    const observers: Observer<any>[] = [{ next() {} }];
    const observerRefs = observers.map((observer) => new WeakRef(observer));

    const concast = new Concast<number>([Observable.of(1, 2), promise]);

    concast.subscribe(observers[0]);
    delete observers[0];

    expect(concast["observers"].size).toBe(1);

    resolve(Observable.of(3, 4));

    await expect(concast.promise).resolves.toBe(4);

    await expect(observerRefs[0]).toBeGarbageCollected();
  });

  it("rejecting a source-wrapping promise of a concast frees all observer references on `this.observers`", async () => {
    const { promise, reject } = deferred<Observable<number>>();
    let subscribingObserver: Observer<any> | undefined = {
      next() {},
      error() {},
    };
    const subscribingObserverRef = new WeakRef(subscribingObserver);

    const concast = new Concast<number>([
      Observable.of(1, 2),
      promise,
      // just to ensure this also works if the cancelling source is not the last source
      Observable.of(3, 5),
    ]);

    concast.subscribe(subscribingObserver);

    expect(concast["observers"].size).toBe(1);

    reject("error");
    await expect(concast.promise).rejects.toBe("error");
    subscribingObserver = undefined;
    await expect(subscribingObserverRef).toBeGarbageCollected();
  });

  it("rejecting a source of a concast frees all observer references on `this.observers`", async () => {
    let subscribingObserver: Observer<any> | undefined = {
      next() {},
      error() {},
    };
    const subscribingObserverRef = new WeakRef(subscribingObserver);

    let sourceObserver!: Observer<number>;
    const sourceObservable = new Observable<number>((o) => {
      sourceObserver = o;
    });

    const concast = new Concast<number>([
      Observable.of(1, 2),
      sourceObservable,
      Observable.of(3, 5),
    ]);

    concast.subscribe(subscribingObserver);

    expect(concast["observers"].size).toBe(1);

    await Promise.resolve();
    sourceObserver.error!("error");
    await expect(concast.promise).rejects.toBe("error");
    subscribingObserver = undefined;
    await expect(subscribingObserverRef).toBeGarbageCollected();
  });

  it("after subscribing to an already-resolved concast, the reference is freed up again", async () => {
    const concast = new Concast<number>([Observable.of(1, 2)]);
    await expect(concast.promise).resolves.toBe(2);
    await Promise.resolve();

    let sourceObserver: Observer<any> | undefined = { next() {}, error() {} };
    const sourceObserverRef = new WeakRef(sourceObserver);

    concast.subscribe(sourceObserver);

    sourceObserver = undefined;
    await expect(sourceObserverRef).toBeGarbageCollected();
  });

  it("after subscribing to an already-rejected concast, the reference is freed up again", async () => {
    const concast = new Concast<number>([Promise.reject("error")]);
    await expect(concast.promise).rejects.toBe("error");
    await Promise.resolve();

    let sourceObserver: Observer<any> | undefined = { next() {}, error() {} };
    const sourceObserverRef = new WeakRef(sourceObserver);

    concast.subscribe(sourceObserver);

    sourceObserver = undefined;
    await expect(sourceObserverRef).toBeGarbageCollected();
  });
});

function deferred<X>() {
  let resolve!: (v: X) => void;
  let reject!: (e: any) => void;
  const promise = new Promise<X>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}
