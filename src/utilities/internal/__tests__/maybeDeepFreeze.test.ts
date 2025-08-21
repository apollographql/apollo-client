import { maybeDeepFreeze } from "@apollo/client/utilities/internal";

test("should deep freeze", () => {
  const foo: any = { bar: undefined };
  maybeDeepFreeze(foo);
  expect(() => (foo.bar = 1)).toThrow();
  expect(foo.bar).toBeUndefined();
});

test("should properly freeze objects without hasOwnProperty", () => {
  const foo: Record<string, any> = {};
  foo.bar = undefined;
  maybeDeepFreeze(foo);
  expect(() => (foo.bar = 1)).toThrow();
});

test("should avoid freezing Uint8Array", () => {
  const result = maybeDeepFreeze({ array: new Uint8Array(1) });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.array)).toBe(false);
});

test("should avoid freezing Buffer", () => {
  const result = maybeDeepFreeze({ oyez: Buffer.from("oyez") });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.oyez)).toBe(false);
});

test("should not freeze child properties of unfreezable objects", () => {
  const result = maybeDeepFreeze({
    buffer: Object.assign(Buffer.from("oyez"), {
      doNotFreeze: { please: "thanks" },
    }),
  });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.buffer)).toBe(false);
  expect(Object.isFrozen(result.buffer.doNotFreeze)).toBe(false);
  expect(result.buffer.doNotFreeze).toEqual({ please: "thanks" });
});
