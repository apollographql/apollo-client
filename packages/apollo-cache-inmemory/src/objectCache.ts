import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';

export class ObjectCache implements NormalizedCache {
  constructor(protected data: NormalizedCacheObject = Object.create(null)) {}

  public toObject() {
    return this.data;
  }
  public get(dataId: string) {
    return this.data[dataId];
  }

  public set(dataId: string, value: StoreObject) {
    this.data[dataId] = value;
  }

  public delete(dataId: string) {
    this.data[dataId] = void 0;
  }

  public clear() {
    this.data = Object.create(null);
  }

  public replace(newData: NormalizedCacheObject) {
    this.data = newData || Object.create(null);
  }
}

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new ObjectCache(seed);
}
