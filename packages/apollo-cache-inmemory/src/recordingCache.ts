import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';

/**
 * KAMIL: It receives a snapshot of a cache
 * Every method is overwritten to save mutated data to recordedData.
 * This way we don't touch the snapshot, we only record changes.
 */
export class RecordingCache implements NormalizedCache {
  constructor(private readonly data: NormalizedCacheObject = {}) {}

  private recordedData: NormalizedCacheObject = {};

  public record(
    transaction: (recordingCache: RecordingCache) => void,
  ): NormalizedCacheObject {
    // M10 - calls InMemoryCache.performTransaction(cache)
    transaction(this);
    // saves udated cache
    const recordedData = this.recordedData;
    // resets
    this.recordedData = {};
    // returns updated one
    return recordedData;
  }

  public toObject(): NormalizedCacheObject {
    return { ...this.data, ...this.recordedData };
  }

  public get(dataId: string): StoreObject {
    if (this.recordedData.hasOwnProperty(dataId)) {
      // recording always takes precedence:
      return this.recordedData[dataId];
    }
    return this.data[dataId];
  }

  public set(dataId: string, value: StoreObject) {
    if (this.get(dataId) !== value) {
      this.recordedData[dataId] = value;
    }
  }

  public delete(dataId: string): void {
    this.recordedData[dataId] = undefined;
  }

  public clear(): void {
    Object.keys(this.data).forEach(dataId => this.delete(dataId));
    this.recordedData = {};
  }

  public replace(newData: NormalizedCacheObject): void {
    this.clear();
    this.recordedData = { ...newData };
  }
}

/**
 * It records all the changes based on a snapshot, performs mutation, and returns only recorded actions (when we used .set() .remove() .add() etc)
 */
export function record(
  startingState: NormalizedCacheObject,
  transaction: (recordingCache: RecordingCache) => void,
): NormalizedCacheObject {
  // M08 - it has a old cache - one that we extracted
  const recordingCache = new RecordingCache(startingState);
  // M09 - record transaction
  return recordingCache.record(transaction);
}
