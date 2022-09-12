import { itAsync } from "../../../testing/core";
import { Observable } from "../Observable";
import { Concast } from "../Concast";

describe("Concast Observable (similar to Behavior Subject in RxJS)", () => {
  itAsync("can concatenate other observables", (resolve, reject) => {
    const concast = new Concast([
      Observable.of(1, 2, 3),
      Promise.resolve(Observable.of(4, 5)),
      Observable.of(6, 7, 8, 9),
      Promise.resolve().then(() => Observable.of(10)),
      Observable.of(11),
    ]);

    const results: number[] = [];
    concast.subscribe({
      next(num) {
        results.push(num);
      },

      error: reject,

      complete() {
        concast.promise.then(finalResult => {
          expect(results).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
          expect(finalResult).toBe(11);
          resolve();
        }).catch(reject);
      },
    });
  });

  itAsync("behaves appropriately if unsubscribed before first result", (resolve, reject) => {
    const concast = new Concast([
      new Promise(resolve => setTimeout(resolve, 100)).then(
        () => Observable.of(1, 2, 3),
      ),
    ]);

    const cleanupCounts = {
      first: 0,
      second: 0,
    };

    concast.cleanup(() => {
      ++cleanupCounts.first;
    });

    const unsubscribe = concast.subscribe({
      next() {
        reject("should not have called observer.next");
      },
      error() {
        reject("should not have called observer.error");
      },
      complete() {
        reject("should not have called observer.complete");
      },
    });

    concast.cleanup(() => {
      ++cleanupCounts.second;
    });

    // Immediately unsubscribe the observer we just added, triggering
    // completion.
    unsubscribe.unsubscribe();

    return concast.promise.then(finalResult => {
      expect(finalResult).toBeUndefined();
      expect(cleanupCounts).toEqual({
        first: 1,
        second: 1,
      });
      resolve();
    }).catch(reject);
  });
});
