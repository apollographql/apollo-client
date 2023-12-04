import type { CommonCache } from "@wry/caches";
import { WeakCache, StrongCache } from "@wry/caches";

const scheduledCleanup = new WeakSet<CommonCache<any, any>>();
function schedule(cache: CommonCache<any, any>) {
  if (!scheduledCleanup.has(cache)) {
    scheduledCleanup.add(cache);
    setTimeout(() => {
      cache.clean();
      scheduledCleanup.delete(cache);
    }, 100);
  }
}
/**
 * A version of WeakCache that will auto-schedule a cleanup of the cache when
 * a new item is added.
 * Throttled to once per 100ms.
 *
 * @privateRemarks
 * Should be used throughout the rest of the codebase instead of WeakCache,
 * with the notable exception of usage in `wrap` from `optimism` - that one
 * already handles cleanup and should remain a `WeakCache`.
 */

export class CleanWeakCache<K extends WeakKey, V> extends WeakCache<K, V> {
  constructor(max: number, dispose?: (value: V) => void) {
    super(max, dispose);
  }
  set(key: K, value: V) {
    schedule(this);
    return super.set(key, value);
  }
}
/**
 * A version of StrongCache that will auto-schedule a cleanup of the cache when
 * a new item is added.
 * Throttled to once per 100ms.
 *
 * @privateRemarks
 * Should be used throughout the rest of the codebase instead of StrongCache,
 * with the notable exception of usage in `wrap` from `optimism` - that one
 * already handles cleanup and should remain a `StrongCache`.
 */

export class CleanStrongCache<K, V> extends StrongCache<K, V> {
  constructor(max: number, dispose?: (value: V) => void) {
    super(max, dispose);
  }
  set(key: K, value: V) {
    schedule(this);
    return super.set(key, value);
  }
}
