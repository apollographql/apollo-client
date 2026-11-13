import { Trie } from "@wry/trie";
import { map, shareReplay } from "rxjs";

import type { ApolloCache } from "@apollo/client";

function mapObservableFragment<From, To>(
  observable: ApolloCache.ObservableFragment<From>,
  mapFn: (
    from: ApolloCache.WatchFragmentResult<From>
  ) => ApolloCache.WatchFragmentResult<To>
): ApolloCache.ObservableFragment<To> {
  let currentResult: ApolloCache.WatchFragmentResult<From>;
  let stableMappedResult: ApolloCache.WatchFragmentResult<To>;

  function toMapped(
    result: ApolloCache.WatchFragmentResult<From>
  ): ApolloCache.WatchFragmentResult<To> {
    if (result !== currentResult) {
      currentResult = result;
      stableMappedResult = mapFn(currentResult);
    }
    return stableMappedResult;
  }

  return Object.assign(
    observable.pipe(
      map(toMapped),
      shareReplay({ bufferSize: 1, refCount: true })
    ),
    {
      getCurrentResult: () => toMapped(observable.getCurrentResult()),
    }
  );
}

const cache = new Trie<{ mapped?: ApolloCache.ObservableFragment<any> }>(true);

export function mapObservableFragmentMemoized<From, To>(
  observable: ApolloCache.ObservableFragment<From>,
  /**
   * used together with `observable` as memoization key, `mapFn` is explicitly not used as memoization key
   */
  _cacheKey: symbol,
  mapFn: (
    from: ApolloCache.WatchFragmentResult<From>
  ) => ApolloCache.WatchFragmentResult<To>
): ApolloCache.ObservableFragment<To> {
  const entry = cache.lookup(observable, _cacheKey);

  return (entry.mapped ??= mapObservableFragment(observable, mapFn));
}
