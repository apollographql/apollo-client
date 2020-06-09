
import { ReactiveVar } from '../../../core';

// It's a good idea to provide the ability to mock Reactive Vars so that
// we can test the behaviour of our interaction logic.

export function createMockReactiveVar<T> (defaultValue?: T): ReactiveVar<T> {
  let currentValue: T | undefined = defaultValue;

  return function mockReactiveVar (
    newValue?: T
  ) : T {
    if (newValue) {
      currentValue = newValue;
    }
    return currentValue as T;
  }
}
