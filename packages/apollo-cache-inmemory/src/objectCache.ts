import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';

export class ObjectCache implements NormalizedCache {
  constructor(private data: NormalizedCacheObject = Object.create(null)) {}
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
    this.data = Object.create(null);
  }
  public replace(newData: NormalizedCacheObject): void {
    this.data = newData || Object.create(null);
  }
}

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new ObjectCache(seed);
}
