import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';

export class ObjectCache implements NormalizedCache {
  constructor(private data: NormalizedCacheObject = {}) {}
  public toObject(): NormalizedCacheObject {
    return this.data;
  }
  public get(dataId: string): StoreObject {
    return this.data[dataId];
  }
  public set(dataId: string, value: StoreObject) {
    this.data[dataId] = value;
  }
  public delete(dataId: string): void {
    this.data[dataId] = undefined;
  }
  public clear(): void {
    this.data = {};
  }
  public replace(newData: NormalizedCacheObject): void {
    this.data = newData || {};
  }
}

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new ObjectCache(seed);
}
