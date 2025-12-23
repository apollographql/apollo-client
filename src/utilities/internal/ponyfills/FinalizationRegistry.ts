import { invariant } from "@apollo/client/utilities/invariant";

interface Entry<T> {
  targetRef: WeakRef<WeakKey>;
  value: T;
}

/**
 * @internal
 *
 * An approximation of `FinalizationRegistry` based on `WeakRef`.
 * While there are registered values, checks every 500ms if any have been garbage collected.
 * The polling interval is cleared once all registered entries have been removed.
 */
export const FinalizationRegistry: typeof globalThis.FinalizationRegistry = class FinalizationRegistry<
  T,
> {
  private intervalLength = 500;
  private callback: (value: T) => void;
  private references = new Set<Entry<T>>();
  private unregisterTokens = new WeakMap<WeakKey, Entry<T>>();
  private interval: ReturnType<typeof setInterval> | null = null;
  constructor(callback: (value: T) => void) {
    this.callback = callback;
    this.handler = this.handler.bind(this);
  }
  handler() {
    if (this.references.size === 0) {
      clearInterval(this.interval!);
      this.interval = null;
      return;
    }
    this.references.forEach((entry) => {
      if (entry.targetRef.deref() === undefined) {
        this.references.delete(entry);
        // Spec deviation: Not catching errors here, might get necessary if used in more places.
        this.callback(entry.value);
      }
    });
  }
  register(target: WeakKey, value: T, unregisterToken?: WeakKey): void {
    const entry = { targetRef: new WeakRef(target), value };
    this.references.add(entry);
    if (unregisterToken) {
      // some simplifications here as it's an internal polyfill
      // we don't allow the same unregisterToken to be reused
      invariant(!this.unregisterTokens.has(unregisterToken));
      this.unregisterTokens.set(unregisterToken, entry);
    }
    if (!this.interval) {
      this.interval = setInterval(this.handler, this.intervalLength);
    }
  }
  unregister(unregisterToken: WeakKey): boolean {
    // Calling `(weak)Set.delete(undefined)` is not covered by the TypeScript types,
    // but valid by the spec (see https://tc39.es/ecma262/multipage/keyed-collections.html#sec-weakset.prototype.delete).
    // Shaving a few bytes here by skipping the undefined check.
    this.references.delete(this.unregisterTokens.get(unregisterToken)!);
    return this.unregisterTokens.delete(unregisterToken);
  }
  [Symbol.toStringTag] = "FinalizationRegistry" as const;
};
