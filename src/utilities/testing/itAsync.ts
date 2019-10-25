function wrap<TResult>(
  original: (...args: any[]) => TResult,
) {
  return (
    message: string,
    callback: (
      resolve: (result?: any) => void,
      reject: (reason?: any) => void,
    ) => any,
    timeout?: number,
  ) => original(message, function () {
    return new Promise(
      (resolve, reject) => callback.call(this, resolve, reject),
    );
  }, timeout);
}

const wrappedIt = wrap(it);
export function itAsync(...args: Parameters<typeof wrappedIt>) {
  return wrappedIt.apply(this, args);
}

export namespace itAsync {
  export const only = wrap(it.only);
  export const skip = wrap(it.skip);
  export const todo = wrap(it.todo);
}
