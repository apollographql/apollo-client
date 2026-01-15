import { map, shareReplay } from "rxjs";

import type { ApolloCache } from "@apollo/client";

import { memoize } from "./memoize.js";

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

export const mapObservableFragmentMemoized = memoize(
  function mapObservableFragmentMemoized<From, To>(
    observable: ApolloCache.ObservableFragment<From>,
    /**
     * used together with `observable` as memoization key, `mapFn` is explicitly not used as memoization key
     */
    _cacheKey: symbol,
    mapFn: (
      from: ApolloCache.WatchFragmentResult<From>
    ) => ApolloCache.WatchFragmentResult<To>
  ): ApolloCache.ObservableFragment<To> {
    return mapObservableFragment(observable, mapFn);
  },
  { max: 1, makeCacheKey: (args) => args.slice(0, 2) }
);
