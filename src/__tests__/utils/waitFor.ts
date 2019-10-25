// Returns a Promise for the result of calling the condition function, as
// soon as the function returns without throwing. While this function may
// still introduce some nondeterminism, we use it only in tests, and it's
// a lot more effective than some other waiting patterns we use in tests.
export function waitFor<T>(condition: () => T, intervalMs: number = 10) {
  return new Promise<T>(resolve => {
    function poll() {
      try {
        resolve(condition());
      } catch {
        setTimeout(poll, intervalMs);
      }
    }
    poll();
  });
}
