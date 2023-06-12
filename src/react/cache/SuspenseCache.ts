import { Trie } from '@wry/trie';
import type { ObservableQuery } from '../../core';
import { canUseWeakMap } from '../../utilities';
import { QueryReference } from './QueryReference';
import type { CacheKey } from './types';

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
  private queryRefs = new Trie<{ current?: QueryReference }>(
    canUseWeakMap,
    () => Object.create(null)
  );
  private options: SuspenseCacheOptions;

  constructor(options: SuspenseCacheOptions = Object.create(null)) {
    this.options = options;
  }

  getQueryRef<TData = any>(
    cacheKey: CacheKey,
    createObservable: () => ObservableQuery<TData>
  ) {
    const ref = this.queryRefs.lookupArray(cacheKey);

    if (!ref.current) {
      ref.current = new QueryReference(createObservable(), {
          key: cacheKey,
          autoDisposeTimeoutMs: this.options.autoDisposeTimeoutMs,
          onDispose: () => { delete ref.current },
        })
    }

    return ref.current as QueryReference<TData>;
  }
}
