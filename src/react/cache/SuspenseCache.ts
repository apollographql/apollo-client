import { Trie } from '@wry/trie';
import type { ObservableQuery } from '../../core';
import { canUseWeakMap } from '../../utilities';
import { QueryReference } from './QueryReference';

type CacheKey = any[];

interface SuspenseCacheOptions {
  /**
   * Specifies the amount of time, in milliseconds, the suspense cache will wait
   * for a suspended component to read from the suspense cache before it
   * automatically disposes of the query. This prevents memory leaks when a
   * component unmounts before a suspended resource finishes loading. Increase
   * the timeout if your queries take longer than than the specified time to
   * prevent your queries from suspending over and over.
   *
   * Defaults to 30 seconds.
   */
  autoDisposeTimeoutMs?: number;
}

export class SuspenseCache {
  private cacheKeys = new Trie<CacheKey>(
    canUseWeakMap,
    (cacheKey: CacheKey) => cacheKey
  );

  private queryRefs = new Map<CacheKey, QueryReference>();
  private options: SuspenseCacheOptions;

  constructor(options: SuspenseCacheOptions = Object.create(null)) {
    this.options = options;
  }

  getQueryRef<TData = any>(
    cacheKey: CacheKey,
    createObservable: () => ObservableQuery<TData>
  ) {
    const stableCacheKey = this.cacheKeys.lookupArray(cacheKey);

    if (!this.queryRefs.has(stableCacheKey)) {
      this.queryRefs.set(
        stableCacheKey,
        new QueryReference(createObservable(), {
          autoDisposeTimeoutMs: this.options.autoDisposeTimeoutMs,
          onDispose: () => this.queryRefs.delete(stableCacheKey),
        })
      );
    }

    return this.queryRefs.get(stableCacheKey)! as QueryReference<TData>;
  }
}
