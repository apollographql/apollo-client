function wrap(key?: "only" | "skip" | "todo") {
  return (
    message: string,
    callback: (
      resolve: (result?: any) => void,
      reject: (reason?: any) => void
    ) => any,
    timeout?: number
  ) =>
    (key ? it[key] : it)(
      message,
      function (this: unknown) {
        return new Promise((resolve, reject) =>
          callback.call(this, resolve, reject)
        );
      },
      timeout
    );
}

const wrappedIt = wrap();

/**
 * @deprecated `itAsync` will be removed with Apollo Client 4.0. Prefer using an
 * `async` callback function or returning a `Promise` from the callback with the
 * `it` or `test` functions.
 */
export const itAsync = Object.assign(
  function (this: unknown, ...args: Parameters<typeof wrappedIt>) {
    return wrappedIt.apply(this, args);
  },
  {
    only: wrap("only"),
    skip: wrap("skip"),
    todo: wrap("todo"),
  }
);
