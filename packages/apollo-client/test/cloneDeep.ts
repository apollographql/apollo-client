import { cloneDeep } from '../src/util/cloneDeep';
import { assert } from 'chai';

describe('cloneDeep', () => {
  it('will clone primitive values', () => {
    assert.equal(cloneDeep(undefined), undefined);
    assert.equal(cloneDeep(null), null);
    assert.equal(cloneDeep(true), true);
    assert.equal(cloneDeep(false), false);
    assert.equal(cloneDeep(-1), -1);
    assert.equal(cloneDeep(+1), +1);
    assert.equal(cloneDeep(0.5), 0.5);
    assert.equal(cloneDeep('hello'), 'hello');
    assert.equal(cloneDeep('world'), 'world');
  });

  it('will clone objects', () => {
    const value1 = {};
    const value2 = { a: 1, b: 2, c: 3 };
    const value3 = { x: { a: 1, b: 2, c: 3 }, y: { a: 1, b: 2, c: 3 } };

    const clonedValue1 = cloneDeep(value1);
    const clonedValue2 = cloneDeep(value2);
    const clonedValue3 = cloneDeep(value3);

    assert.deepEqual(clonedValue1, value1);
    assert.deepEqual(clonedValue2, value2);
    assert.deepEqual(clonedValue3, value3);

    assert.notStrictEqual(clonedValue1, value1);
    assert.notStrictEqual(clonedValue2, value2);
    assert.notStrictEqual(clonedValue3, value3);
    assert.notStrictEqual(clonedValue3.x, value3.x);
    assert.notStrictEqual(clonedValue3.y, value3.y);
  });

  it('will clone arrays', () => {
    const value1: Array<number> = [];
    const value2 = [1, 2, 3];
    const value3 = [[1, 2, 3], [1, 2, 3]];

    const clonedValue1 = cloneDeep(value1);
    const clonedValue2 = cloneDeep(value2);
    const clonedValue3 = cloneDeep(value3);

    assert.deepEqual(clonedValue1, value1);
    assert.deepEqual(clonedValue2, value2);
    assert.deepEqual(clonedValue3, value3);

    assert.notStrictEqual(clonedValue1, value1);
    assert.notStrictEqual(clonedValue2, value2);
    assert.notStrictEqual(clonedValue3, value3);
    assert.notStrictEqual(clonedValue3[0], value3[0]);
    assert.notStrictEqual(clonedValue3[1], value3[1]);
  });
});
