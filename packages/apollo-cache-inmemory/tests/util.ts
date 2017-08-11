import { assert } from 'chai';

export function withWarning(func: Function, regex: RegExp) {
  let message: string = null as never;
  const oldWarn = console.warn;

  console.warn = (m: string) => (message = m);

  return Promise.resolve(func()).then(val => {
    assert.match(message, regex);
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
    assert.match(message, regex);
    return result;
  } finally {
    console.error = oldError;
  }
}
