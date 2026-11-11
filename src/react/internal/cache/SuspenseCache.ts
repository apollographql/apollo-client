import { Trie } from "@wry/trie";

import type { DataState, ObservableQuery } from "@apollo/client";
import type { ApolloCache } from "@apollo/client/cache";

import { FragmentReference } from "./FragmentReference.js";
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
  private queryRefs = new Trie<{ current?: InternalQueryReference }>();
  private fragmentRefs = new Trie<{ current?: FragmentReference }>();

  private options: SuspenseCacheOptions;

  constructor(options: SuspenseCacheOptions = {}) {
    this.options = options;
  }

  getQueryRef<
    TData = unknown,
    TStates extends
      DataState<TData>["dataState"] = DataState<TData>["dataState"],
  >(cacheKey: CacheKey, createObservable: () => ObservableQuery<TData>) {
    const ref = this.queryRefs.lookupArray(cacheKey) as {
      current?: InternalQueryReference<TData, TStates>;
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

  getFragmentRef<TData>(
    observable: ApolloCache.ObservableFragment<TData | null>
  ) {
    const ref = this.fragmentRefs.lookup(observable) as {
      current?: FragmentReference<TData>;
    };

    if (!ref.current) {
      ref.current = new FragmentReference(observable, {
        autoDisposeTimeoutMs: this.options.autoDisposeTimeoutMs,
        onDispose: () => {
          delete ref.current;
        },
      });
    }

    return ref.current;
  }

  add(cacheKey: CacheKey, queryRef: InternalQueryReference<any, any>) {
    const ref = this.queryRefs.lookupArray(cacheKey);
    ref.current = queryRef;
  }
}
