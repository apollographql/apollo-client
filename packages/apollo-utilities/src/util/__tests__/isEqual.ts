import { isEqual } from '../isEqual';

describe('isEqual', () => {
  it('should return true for equal primitive values', () => {
    expect(isEqual(undefined, undefined)).toBe(true);
    expect(isEqual(null, null)).toBe(true);
    expect(isEqual(true, true)).toBe(true);
    expect(isEqual(false, false)).toBe(true);
    expect(isEqual(-1, -1)).toBe(true);
    expect(isEqual(+1, +1)).toBe(true);
    expect(isEqual(42, 42)).toBe(true);
    expect(isEqual(0, 0)).toBe(true);
    expect(isEqual(0.5, 0.5)).toBe(true);
    expect(isEqual('hello', 'hello')).toBe(true);
    expect(isEqual('world', 'world')).toBe(true);
  });

  it('should return false for not equal primitive values', () => {
    expect(!isEqual(undefined, null)).toBe(true);
    expect(!isEqual(null, undefined)).toBe(true);
    expect(!isEqual(true, false)).toBe(true);
    expect(!isEqual(false, true)).toBe(true);
    expect(!isEqual(-1, +1)).toBe(true);
    expect(!isEqual(+1, -1)).toBe(true);
    expect(!isEqual(42, 42.00000000000001)).toBe(true);
    expect(!isEqual(0, 0.5)).toBe(true);
    expect(!isEqual('hello', 'world')).toBe(true);
    expect(!isEqual('world', 'hello')).toBe(true);
  });

  it('should return false when comparing primitives with objects', () => {
    expect(!isEqual({}, null)).toBe(true);
    expect(!isEqual(null, {})).toBe(true);
    expect(!isEqual({}, true)).toBe(true);
    expect(!isEqual(true, {})).toBe(true);
    expect(!isEqual({}, 42)).toBe(true);
    expect(!isEqual(42, {})).toBe(true);
    expect(!isEqual({}, 'hello')).toBe(true);
    expect(!isEqual('hello', {})).toBe(true);
  });

  it('should correctly compare shallow objects', () => {
    expect(isEqual({}, {})).toBe(true);
    expect(isEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 })).toBe(true);
    expect(!isEqual({ a: 1, b: 2, c: 3 }, { a: 3, b: 2, c: 1 })).toBe(true);
    expect(!isEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 })).toBe(true);
    expect(!isEqual({ a: 1, b: 2 }, { a: 1, b: 2, c: 3 })).toBe(true);
  });

  it('should correctly compare deep objects', () => {
    expect(isEqual({ x: {} }, { x: {} })).toBe(true);
    expect(
      isEqual({ x: { a: 1, b: 2, c: 3 } }, { x: { a: 1, b: 2, c: 3 } }),
    ).toBe(true);
    expect(
      !isEqual({ x: { a: 1, b: 2, c: 3 } }, { x: { a: 3, b: 2, c: 1 } }),
    ).toBe(true);
    expect(!isEqual({ x: { a: 1, b: 2, c: 3 } }, { x: { a: 1, b: 2 } })).toBe(
      true,
    );
    expect(!isEqual({ x: { a: 1, b: 2 } }, { x: { a: 1, b: 2, c: 3 } })).toBe(
      true,
    );
  });

  it('should correctly compare deep objects without object prototype ', () => {
    // Solves https://github.com/apollographql/apollo-client/issues/2132
    const objNoProto = Object.create(null);
    objNoProto.a = { b: 2, c: [3, 4] };
    objNoProto.e = Object.create(null);
    objNoProto.e.f = 5;
    expect(isEqual(objNoProto, { a: { b: 2, c: [3, 4] }, e: { f: 5 } })).toBe(
      true,
    );
    expect(!isEqual(objNoProto, { a: { b: 2, c: [3, 4] }, e: { f: 6 } })).toBe(
      true,
    );
    expect(!isEqual(objNoProto, { a: { b: 2, c: [3, 4] }, e: null })).toBe(
      true,
    );
    expect(!isEqual(objNoProto, { a: { b: 2, c: [3] }, e: { f: 5 } })).toBe(
      true,
    );
    expect(!isEqual(objNoProto, null)).toBe(true);
  });

  it('should correctly handle modified prototypes', () => {
    Array.prototype.foo = null;
    expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(!isEqual([1, 2, 3], [1, 2, 4])).toBe(true);
    delete Array.prototype.foo;
  });
});
