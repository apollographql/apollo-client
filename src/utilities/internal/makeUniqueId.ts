const prefixCounts = new Map<string, number>();

// TODO: This looks like it could be a memory leak since it sets the prefix in
// the map above, but never gets cleaned up.

/**
 * These IDs won't be globally unique, but they will be unique within this
 * process, thanks to the counter, and unguessable thanks to the random suffix.
 *
 * @internal
 */
export function makeUniqueId(prefix: string) {
  const count = prefixCounts.get(prefix) || 1;
  prefixCounts.set(prefix, count + 1);
  return `${prefix}:${count}:${Math.random().toString(36).slice(2)}`;
}
