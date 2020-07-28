function wrap<TResult>(key?: "only" | "skip" | "todo") {
  return (
    message: string,
    callback: (
      resolve: (result?: any) => void,
      reject: (reason?: any) => void,
    ) => any,
    timeout?: number,
  ) => (key ? it[key] : it)(message, function () {
    return new Promise(
      (resolve, reject) => callback.call(this, resolve, reject),
    );
  }, timeout);
}

const wrappedIt = wrap();
export function itAsync(...args: Parameters<typeof wrappedIt>) {
  return wrappedIt.apply(this, args);
}

export namespace itAsync {
  export const only = wrap("only");
  export const skip = wrap("skip");
  export const todo = wrap("todo");
}
