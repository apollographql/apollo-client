import { Trie } from "@wry/trie";

import { AutoCleanedWeakCache } from "./caches.js";

/**
 * Naive alternative to `wrap` without any dependency tracking, potentially avoiding resulting memory leaks.
 */
export function memoize<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => TResult,
  { max }: { max: number }
): (...args: TArgs) => TResult {
  const keys = new Trie<{}>(true);
  const cache = new AutoCleanedWeakCache<
    {},
    { result?: TResult; error?: unknown }
  >(max);

  return (...args: TArgs): TResult => {
    const cacheKey = keys.lookupArray(args);
    const cached = cache.get(cacheKey);
    if (cached) {
      if (cached.error) {
        throw cached.error;
      }
      return cached.result!;
    }

    const entry = cache.set(cacheKey, {});
    try {
      return (entry.result = fn(...args));
    } catch (error) {
      entry.error = error;
      throw error;
    }
  };
}
