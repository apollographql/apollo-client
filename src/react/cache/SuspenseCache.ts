import { Trie } from '@wry/trie';
import { ObservableQuery } from '../../core';
import { canUseWeakMap } from '../../utilities';
import { QuerySubscription } from './QuerySubscription';

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

  private subscriptions = new Map<CacheKey, QuerySubscription>();
  private options: SuspenseCacheOptions;

  constructor(options: SuspenseCacheOptions = Object.create(null)) {
    this.options = options;
  }

  getSubscription<TData = any>(
    cacheKey: CacheKey,
    createObservable: () => ObservableQuery<TData>
  ) {
    const stableCacheKey = this.cacheKeys.lookupArray(cacheKey);

    if (!this.subscriptions.has(stableCacheKey)) {
      this.subscriptions.set(
        stableCacheKey,
        new QuerySubscription(createObservable(), {
          autoDisposeTimeoutMs: this.options.autoDisposeTimeoutMs,
          onDispose: () => this.subscriptions.delete(stableCacheKey),
        })
      );
    }

    return this.subscriptions.get(stableCacheKey)! as QuerySubscription<TData>;
  }
}