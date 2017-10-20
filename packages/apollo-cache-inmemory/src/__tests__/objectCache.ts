import { ObjectCache } from '../objectCache';
import { NormalizedCacheObject } from '../types';

describe('ObjectCache', () => {
  it('should create an empty cache', () => {
    const cache = new ObjectCache();
    expect(cache.toObject()).toEqual({});
  });

  it('should create a cache based on an Object', () => {
    const contents: NormalizedCacheObject = { a: {} };
    const cache = new ObjectCache(contents);
    expect(cache.toObject()).toEqual(contents);
  });

  it(`should .get() an object from the store by dataId`, () => {
    const contents: NormalizedCacheObject = { a: {} };
    const cache = new ObjectCache(contents);
    expect(cache.get('a')).toBe(contents.a);
  });

  it(`should .set() an object from the store by dataId`, () => {
    const obj = {};
    const cache = new ObjectCache();
    cache.set('a', obj);
    expect(cache.get('a')).toBe(obj);
  });

  it(`should .clear() the store`, () => {
    const obj = {};
    const cache = new ObjectCache();
    cache.set('a', obj);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
  });
});
