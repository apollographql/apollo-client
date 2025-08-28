import { invariant } from "@apollo/client/utilities/invariant";

interface Entry<T> {
  targetRef: WeakRef<WeakKey>;
  value: T;
}

/**
 * An approximation of `FinalizationRegistry` based on `WeakRef`.
 * Checks every 500ms if registered values have been garbage collected.
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
    this.references.delete(this.unregisterTokens.get(unregisterToken)!);
    return this.unregisterTokens.delete(unregisterToken);
  }
  [Symbol.toStringTag] = "FinalizationRegistry" as const;
};
