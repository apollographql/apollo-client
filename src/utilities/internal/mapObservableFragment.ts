import type { ApolloCache } from "@apollo/client";
import { map } from "rxjs";

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

  return Object.assign(observable.pipe(map(toMapped)), {
    getCurrentResult: () => toMapped(observable.getCurrentResult()),
  });
}

export function mapObservableFragmentMemoized<From, To>(
  observable: ApolloCache.ObservableFragment<From>,
  memoizationSymbol: symbol,
  mapFn: (
    from: ApolloCache.WatchFragmentResult<From>
  ) => ApolloCache.WatchFragmentResult<To>
): ApolloCache.ObservableFragment<To> {
  return ((observable as any)[memoizationSymbol] ??= mapObservableFragment(
    observable,
    mapFn
  ));
}
