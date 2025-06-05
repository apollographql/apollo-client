import { Trie } from "@wry/trie";

import type {
  ApolloClient,
  DataState,
  ObservableQuery,
  OperationVariables,
  WatchFragmentOptions,
} from "@apollo/client";

import { FragmentReference } from "./FragmentReference.js";
import { InternalQueryReference } from "./QueryReference.js";
import type { CacheKey, FragmentCacheKey } from "./types.js";

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

  getFragmentRef<TData, TVariables extends OperationVariables>(
    cacheKey: FragmentCacheKey,
    client: ApolloClient,
    options: WatchFragmentOptions<TData, TVariables> & { from: string }
  ) {
    const ref = this.fragmentRefs.lookupArray(cacheKey) as {
      current?: FragmentReference<TData, TVariables>;
    };

    if (!ref.current) {
      ref.current = new FragmentReference(client, options, {
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
