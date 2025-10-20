import { EMPTY, Observable } from "rxjs";

/**
 * Like `combineLatest` but with some differences:
 *
 * - It only works on arrays as an input
 * - Batches updates to each array index that contains a referentially equal
 *   observable
 * - Doesn't allow for custom scheduler
 * - Expects array of constructed observables instead of `Array<ObservableInput>`
 */
export function combineLatestBatched<T>(observables: Array<Observable<T>>) {
  if (observables.length === 0) {
    return EMPTY;
  }

  return new Observable<Array<T>>((observer) => {
    const { length } = observables;
    // Keeps track of current values for each observable
    const values: T[] = Array.from({ length });
    // Track the number of active subscriptions so we know when to complete this
    // observable
    let active = length;
    // Track how many observables are left to emit their first value
    let remainingFirstValues = length;

    // Used to batch an update each item in the array that share an observable
    // so that they can be emitted together.
    const indexesByObservable = new Map<Observable<T>, Set<number>>();

    observables.forEach((source, idx) => {
      if (!indexesByObservable.has(source)) {
        indexesByObservable.set(source, new Set());
      }

      indexesByObservable.get(source)!.add(idx);
    });

    // Subscribe to each unique observable instead of the raw source array of
    // observables since we want at most 1-subscription per unique observable.
    // This ensures an update can write to multiple indexes before emitting the
    // result.
    indexesByObservable.forEach((indexes, source) => {
      let hasFirstValue = false;
      const subscription = source.subscribe({
        next: (value) => {
          indexes.forEach((idx) => (values[idx] = value));

          if (!hasFirstValue) {
            hasFirstValue = true;
            remainingFirstValues -= indexes.size;
          }

          if (!remainingFirstValues) {
            observer.next(values.slice());
          }
        },
        complete: () => {
          active -= indexes.size;

          if (!active) {
            observer.complete();
          }
        },
        error: observer.error.bind(observer),
      });

      observer.add(subscription);
    });
  });
}
