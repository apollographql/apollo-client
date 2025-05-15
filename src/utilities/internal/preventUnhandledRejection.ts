export function preventUnhandledRejection<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});

  return promise;
}
