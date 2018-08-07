// I'm not sure why mocha doesn't provide something like this, you can't
// always use promises
export default (done: jest.DoneCallback, cb: (...args: any[]) => any) => (
  ...args: any[]
) => {
  try {
    return cb(...args);
  } catch (e) {
    done.fail(e);
  }
};

export function withWarning(func: Function, regex: RegExp) {
  let message: string = null as never;
  const oldWarn = console.warn;

  console.warn = (m: string) => (message = m);

  return Promise.resolve(func()).then(val => {
    expect(message).toMatch(regex);
    console.warn = oldWarn;
    return val;
  });
}

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
