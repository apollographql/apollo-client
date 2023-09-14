// I'm not sure why mocha doesn't provide something like this, you can't
// always use promises
export default <TArgs extends any[], TResult>(
    reject: (reason: any) => any,
    cb: (...args: TArgs) => TResult
  ) =>
  (...args: TArgs) => {
    try {
      return cb(...args);
    } catch (e) {
      reject(e);
    }
  };

export function withError(func: Function, regex: RegExp) {
  let message: string = null as never;
  const oldError = console.error;

  console.error = (m: string) => (message = m);

  try {
    const result = func();
    expect(message).toMatch(regex);
    return result;
  } finally {
    console.error = oldError;
  }
}
