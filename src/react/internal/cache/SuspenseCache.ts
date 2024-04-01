import { Trie } from "@wry/trie";
import type { ObservableQuery } from "../../../core/index.js";
import { canUseWeakMap } from "../../../utilities/index.js";
import { InternalQueryReference } from "./QueryReference.js";
import type { CacheKey } from "./types.js";

export interface SuspenseCacheOptions {
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
  private queryRefs = new Trie<{ current?: InternalQueryReference }>(
    canUseWeakMap
  );
  private options: SuspenseCacheOptions;

  constructor(options: SuspenseCacheOptions = Object.create(null)) {
    this.options = options;
  }

  getQueryRef<TData = any>(
    cacheKey: CacheKey,
    createObservable: () => ObservableQuery<TData>
  ) {
    const ref = this.queryRefs.lookupArray(cacheKey) as {
      current?: InternalQueryReference<TData>;
    };

    if (!ref.current) {
      ref.current = new InternalQueryReference(createObservable(), {
        autoDisposeTimeoutMs: this.options.autoDisposeTimeoutMs,
        onDispose: () => {
          delete ref.current;
        },
      });
    }

    return ref.current;
  }

  add(cacheKey: CacheKey, queryRef: InternalQueryReference<unknown>) {
    const ref = this.queryRefs.lookupArray(cacheKey);
    ref.current = queryRef;
  }
}
