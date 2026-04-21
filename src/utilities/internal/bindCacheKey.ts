import { defaultMakeCacheKey } from "optimism";

/**
 * A variant of `optimism`'s `defaultMakeCacheKey` function that allows us to
 * pre-bind some arguments to be part of the cache key Trie path.
 *
 * This should always be used in place of `defaultMakeCacheKey` to bind
 * the `this` context of classes owning wrapped functions, to ensure that
 * the cache keys are collected from memory when the owning object is garbage collected.
 *
 * Without this, cache keys can stay in memory indefinitely, even though the owning
 * Apollo Client instance is long gone.
 * This is a risk in long-running processes with `[DocumentNode, string, string]`
 * style cache keys with persistent document nodes.
 */
export function bindCacheKey(...prebound: object[]): (...args: any) => object {
  return defaultMakeCacheKey.bind(null, ...prebound);
}
