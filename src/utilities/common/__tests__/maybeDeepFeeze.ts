import { maybeDeepFreeze } from '../maybeDeepFreeze';

describe('maybeDeepFreeze', () => {
  it('should deep freeze', () => {
    const foo: any = { bar: undefined };
    maybeDeepFreeze(foo);
    expect(() => (foo.bar = 1)).toThrow();
    expect(foo.bar).toBeUndefined();
  });

  it('should properly freeze objects without hasOwnProperty', () => {
    const foo = Object.create(null);
    foo.bar = undefined;
    maybeDeepFreeze(foo);
    expect(() => (foo.bar = 1)).toThrow();
  });

  it('should freeze a TypedArray', () => {
    const foo = {bar: new Uint8Array(1)};
    maybeDeepFreeze(foo);
  })
});
