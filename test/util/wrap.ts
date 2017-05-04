import * as chai from 'chai';
const { assert } = chai;

// I'm not sure why mocha doesn't provide something like this, you can't
// always use promises
export default (done: MochaDone, cb: (...args: any[]) => any) => (...args: any[]) => {
  try {
    return cb(...args);
  } catch (e) {
    done(e);
  }
};

export function withWarning(func: Function, regex: RegExp) {
  let message: string = null as never;
  const oldWarn = console.warn;

  console.warn = (m: string) => message = m;

  return Promise.resolve(func()).then(() => {
    assert.match(message, regex);
    console.warn = oldWarn;
  });
}

export function withError(func: Function, regex: RegExp) {
  let message: string = null as never;
  const oldError = console.error;

  console.error = (m: string) => message = m;

  try {
    const result = func();
    assert.match(message, regex);
    return result;

  } finally {
    console.error = oldError;
  }
}
