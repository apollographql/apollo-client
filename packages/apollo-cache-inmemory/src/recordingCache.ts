import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';

export class RecordingCache implements NormalizedCache {
  private recordedData: NormalizedCacheObject = {};

  constructor(private readonly data: NormalizedCacheObject = {}) {}

  public record(
    transaction: (recordingCache: RecordingCache) => void,
  ): NormalizedCacheObject {
    transaction(this);
    const recordedData = this.recordedData;
    this.recordedData = {};
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

export function record(
  startingState: NormalizedCacheObject,
  transaction: (recordingCache: RecordingCache) => void,
): NormalizedCacheObject {
  const recordingCache = new RecordingCache(startingState);
  return recordingCache.record(transaction);
}
