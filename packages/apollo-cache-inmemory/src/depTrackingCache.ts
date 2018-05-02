import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';
import { wrap } from './optimism';

const hasOwn = Object.prototype.hasOwnProperty;

// Wrapper function produced by the optimism library, used to depend on
// dataId strings, for easy invalidation of specific IDs.
const depend = wrap((
  data: NormalizedCacheObject,
  dataId: string,
) => data[dataId], {
  disposable: true,
});

export class DepTrackingCache implements NormalizedCache {
  constructor(private data: NormalizedCacheObject = Object.create(null)) {}

  public toObject(): NormalizedCacheObject {
    return this.data;
  }

  public get(dataId: string): StoreObject {
    depend(this.data, dataId);
    return this.data[dataId];
  }

  public set(dataId: string, value: StoreObject) {
    const oldValue = this.data[dataId];
    if (value !== oldValue) {
      this.data[dataId] = value;
      depend.dirty(this.data, dataId);
    }
  }

  public delete(dataId: string): void {
    if (hasOwn.call(this.data, dataId)) {
      delete this.data[dataId];
      depend.dirty(this.data, dataId);
    }
  }

  public clear(): void {
    this.replace(null);
  }

  public replace(newData: NormalizedCacheObject): void {
    if (newData) {
      Object.keys(newData).forEach(dataId => {
        this.set(dataId, newData[dataId]);
      });
      Object.keys(this.data).forEach(dataId => {
        if (! hasOwn.call(newData, dataId)) {
          this.delete(dataId);
        }
      });
    } else {
      Object.keys(this.data).forEach(dataId => {
        this.delete(dataId);
      });
    }
  }
}

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new DepTrackingCache(seed);
}
