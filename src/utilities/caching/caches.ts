import { WeakCache, StrongCache } from "@wry/caches";

interface CleanableCache {
  size: number;
  max?: number;
  clean: () => void;
}
const scheduledCleanup = new WeakSet<CleanableCache>();
function schedule(cache: CleanableCache) {
  if (cache.size <= (cache.max || -1)) {
    return;
  }
  if (!scheduledCleanup.has(cache)) {
    scheduledCleanup.add(cache);
    setTimeout(() => {
      cache.clean();
      scheduledCleanup.delete(cache);
    }, 100);
  }
}
/**
 * @internal
 * A version of WeakCache that will auto-schedule a cleanup of the cache when
 * a new item is added and the cache reached maximum size.
 * Throttled to once per 100ms.
 *
 * @privateRemarks
 * Should be used throughout the rest of the codebase instead of WeakCache,
 * with the notable exception of usage in `wrap` from `optimism` - that one
 * already handles cleanup and should remain a `WeakCache`.
 */
export const AutoCleanedWeakCache = function (
  max?: number | undefined,
  dispose?: ((value: any, key: any) => void) | undefined
) {
  /*
  Some builds of `WeakCache` are function prototypes, some are classes.
  This library still builds with an ES5 target, so we can't extend the
  real classes.
  Instead, we have to use this workaround until we switch to a newer build
  target.
  */
  const cache = new WeakCache(max, dispose);
  cache.set = function (key: any, value: any) {
    const ret = WeakCache.prototype.set.call(this, key, value);
    schedule(this as any as CleanableCache);
    return ret;
  };
  return cache;
} as any as typeof WeakCache;
/**
 * @internal
 */
export type AutoCleanedWeakCache<K extends object, V> = WeakCache<K, V>;

/**
 * @internal
 * A version of StrongCache that will auto-schedule a cleanup of the cache when
 * a new item is added and the cache reached maximum size.
 * Throttled to once per 100ms.
 *
 * @privateRemarks
 * Should be used throughout the rest of the codebase instead of StrongCache,
 * with the notable exception of usage in `wrap` from `optimism` - that one
 * already handles cleanup and should remain a `StrongCache`.
 */
export const AutoCleanedStrongCache = function (
  max?: number | undefined,
  dispose?: ((value: any, key: any) => void) | undefined
) {
  /*
  Some builds of `StrongCache` are function prototypes, some are classes.
  This library still builds with an ES5 target, so we can't extend the
  real classes.
  Instead, we have to use this workaround until we switch to a newer build
  target.
  */
  const cache = new StrongCache(max, dispose);
  cache.set = function (key: any, value: any) {
    const ret = StrongCache.prototype.set.call(this, key, value);
    schedule(this as any as CleanableCache);
    return ret;
  };
  return cache;
} as any as typeof StrongCache;
/**
 * @internal
 */
export type AutoCleanedStrongCache<K, V> = StrongCache<K, V>;
