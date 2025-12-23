export function promiseWithResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T | Promise<T>) => void;
  reject: (reason?: any) => void;
} {
  let resolve!: (value: T | Promise<T>) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
