import { Observable } from '../../src/util/Observable';

/**
 * A utility function that sets up a test for any observable value. You provide
 * an observable and one or more check functions. If all the checks run
 * sucesfully the test will pass. If one check fails the test will fail. If the
 * observable errors the test will fail. If the observable emits a value more
 * times then there are checks the test will fail. If the observable completes
 * then the test will fail.
 *
 * This function is best used to test hot observables which emit a known number
 * of values.
 *
 * Usage:
 *
 * ```
 * it('will do something', done => {
 *   // Setup...
 *
 *   testObservable(
 *     done,
 *     myObservable,                      // The observable you want to test.
 *     (value) => { ... },                // Assertions for the first value.
 *     (value, previousValue) => { ... }, // Assertions for the second value.
 *     (value, previousValue) => { ... }, // Assertions for the third value.
 *   );
 * });
 * ```
 */
export function testObservable <TValue>(
  done: MochaDone,
  observable: Observable<TValue>,
  firstCheck: (data: TValue) => void,
  ...restChecks: Array<(data: TValue, previousData: TValue | undefined) => void>,
) {
  let previousValue: TValue | undefined;
  const checks = [firstCheck, ...restChecks];
  let i = 0;

  const subscription = observable.subscribe({
    next: value => {
      const check = checks[i++];
      if (typeof check === 'undefined') {
        subscription.unsubscribe();
        done(new Error('Observable `next` callback called one two many times.'));
      }
      try {
        check(value, previousValue);
        previousValue = value;
        if (i === checks.length) {
          subscription.unsubscribe();
          done();
        }
      } catch (error) {
        subscription.unsubscribe();
        done(error);
      }
    },
    error: error => {
      subscription.unsubscribe();
      done(error);
    },
    complete: () => {
      subscription.unsubscribe();
      done(new Error('Did not expect the observer to complete.'));
    },
  });
}
