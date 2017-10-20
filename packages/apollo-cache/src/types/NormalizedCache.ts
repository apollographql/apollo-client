import { StoreValue } from 'apollo-utilities';

/**
 * This is an interface used to access, set and remove
 * StoreObjects from the cache
 */
export interface NormalizedCache {
  get(dataId: string): StoreObject;
  set(dataId: string, value: StoreObject): void;
  delete(dataId: string): void;
  clear(): void;

  // non-Map elements:
  /**
   * returns an Object with key-value pairs matching the contents of the store
   */
  toObject(): NormalizedCacheObject;
  /**
   * replace the state of the store
   */
  replace(newData: NormalizedCacheObject): void;
}

/**
 * This is a normalized representation of the Apollo query result cache. It consists of
 * a flattened representation of query result trees.
 */
export interface NormalizedCacheObject {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}
