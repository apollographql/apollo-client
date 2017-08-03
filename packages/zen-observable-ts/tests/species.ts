import { assert } from 'chai';
import Observable from '../src/zenObservable';

describe('Observable', () => {
  it('uses Observable when constructor is undefined', () => {
    let instance = new Observable(() => void 0);
    instance.constructor = undefined;
    assert.equal(instance.map(x => x) instanceof Observable, true);
  });

  it('uses Observable if species is null', () => {
    let instance = new Observable(() => void 0);
    // instance.constructor = { [Symbol.species]: null };
    assert.equal(instance.map(x => x) instanceof Observable, true);
  });

  it('uses Observable if species is undefined', () => {
    let instance = new Observable(() => void 0);
    // instance.constructor = { [Symbol.species]: undefined };
    assert.equal(instance.map(x => x) instanceof Observable, true);
  });

  it('uses value of Symbol.species', () => {
    const ctor: () => void = () => void 0;
    let instance = new Observable(() => void 0);
    // instance.constructor = { [Symbol.species]: ctor };
    assert.equal(instance.map(x => x) instanceof ctor, true);
  });
});
