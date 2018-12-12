import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';

/**
 * A Map-based implementation of the NormalizedCache.
 * Note that you need a polyfill for Object.entries for this to work.
 */
export class MapCache implements NormalizedCache {
  private cache: Map<string, StoreObject>;

  constructor(data: NormalizedCacheObject = {}) {
    this.cache = new Map(Object.entries(data));
  }

  public get(dataId: string): StoreObject {
    return this.cache.get(`${dataId}`);
  }

  public set(dataId: string, value: StoreObject): void {
    this.cache.set(`${dataId}`, value);
  }

  public delete(dataId: string): void {
    this.cache.delete(`${dataId}`);
  }

  public clear(): void {
    return this.cache.clear();
  }

  public toObject(): NormalizedCacheObject {
    const obj: NormalizedCacheObject = {};
    this.cache.forEach((dataId, key) => {
      obj[key] = dataId;
    });
    return obj;
  }

  public replace(newData: NormalizedCacheObject): void {
    this.cache.clear();
    Object.entries(newData).forEach(([dataId, value]) =>
      this.cache.set(dataId, value),
    );
  }
}

export function mapNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new MapCache(seed);
}
