import { isEqual } from '../src/util/isEqual';
import { assert } from 'chai';

describe('isEqual', () => {
  it('should return true for equal primitive values', () => {
    assert(isEqual(undefined, undefined));
    assert(isEqual(null, null));
    assert(isEqual(true, true));
    assert(isEqual(false, false));
    assert(isEqual(-1, -1));
    assert(isEqual(+1, +1));
    assert(isEqual(42, 42));
    assert(isEqual(0, 0));
    assert(isEqual(0.5, 0.5));
    assert(isEqual('hello', 'hello'));
    assert(isEqual('world', 'world'));
  });

  it('should return false for not equal primitive values', () => {
    assert(!isEqual(undefined, null));
    assert(!isEqual(null, undefined));
    assert(!isEqual(true, false));
    assert(!isEqual(false, true));
    assert(!isEqual(-1, +1));
    assert(!isEqual(+1, -1));
    assert(!isEqual(42, 42.00000000000001));
    assert(!isEqual(0, 0.5));
    assert(!isEqual('hello', 'world'));
    assert(!isEqual('world', 'hello'));
  });

  it('should return false when comparing primitives with objects', () => {
    assert(!isEqual({}, null));
    assert(!isEqual(null, {}));
    assert(!isEqual({}, true));
    assert(!isEqual(true, {}));
    assert(!isEqual({}, 42));
    assert(!isEqual(42, {}));
    assert(!isEqual({}, 'hello'));
    assert(!isEqual('hello', {}));
  });

  it('should correctly compare shallow objects', () => {
    assert(isEqual({}, {}));
    assert(isEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 }));
    assert(!isEqual({ a: 1, b: 2, c: 3 }, { a: 3, b: 2, c: 1 }));
    assert(!isEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }));
    assert(!isEqual({ a: 1, b: 2 }, { a: 1, b: 2, c: 3 }));
  });

  it('should correctly compare deep objects', () => {
    assert(isEqual({ x: {} }, { x: {} }));
    assert(isEqual({ x: { a: 1, b: 2, c: 3 } }, { x: { a: 1, b: 2, c: 3 } }));
    assert(!isEqual({ x: { a: 1, b: 2, c: 3 } }, { x: { a: 3, b: 2, c: 1 } }));
    assert(!isEqual({ x: { a: 1, b: 2, c: 3 } }, { x: { a: 1, b: 2 } }));
    assert(!isEqual({ x: { a: 1, b: 2 } }, { x: { a: 1, b: 2, c: 3 } }));
  });
});
