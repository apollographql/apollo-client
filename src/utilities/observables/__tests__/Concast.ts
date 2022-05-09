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
});
