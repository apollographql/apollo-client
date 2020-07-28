const itIsDefined = typeof it === "object";

function wrap<TResult>(
  original: ((...args: any[]) => TResult) | false,
) {
  return (
    message: string,
    callback: (
      resolve: (result?: any) => void,
      reject: (reason?: any) => void,
    ) => any,
    timeout?: number,
  ) => original && original(message, function () {
    return new Promise(
      (resolve, reject) => callback.call(this, resolve, reject),
    );
  }, timeout);
}

const wrappedIt = wrap(itIsDefined && it);
export function itAsync(...args: Parameters<typeof wrappedIt>) {
  return wrappedIt.apply(this, args);
}

export namespace itAsync {
  export const only = wrap(itIsDefined && it.only);
  export const skip = wrap(itIsDefined && it.skip);
  export const todo = wrap(itIsDefined && it.todo);
}
