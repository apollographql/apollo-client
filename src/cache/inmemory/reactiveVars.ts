import { Slot } from "@wry/context";
import { dep } from "optimism";
import { InMemoryCache } from "./inMemoryCache";

export type ReactiveVar<T> = (newValue?: T) => T;

const varDep = dep<ReactiveVar<any>>();

// Contextual Slot that acquires its value when custom read functions are
// called in Policies#readField.
export const cacheSlot = new Slot<InMemoryCache>();

export function makeVar<T>(value: T): ReactiveVar<T> {
  const caches = new Set<InMemoryCache>();

  return function rv(newValue) {
    if (arguments.length > 0) {
      if (value !== newValue) {
        value = newValue!;
        varDep.dirty(rv);
        // Trigger broadcast for any caches that were previously involved
        // in reading this variable.
        caches.forEach(broadcast);
      }
    } else {
      // When reading from the variable, obtain the current InMemoryCache
      // from context via cacheSlot. This isn't entirely foolproof, but
      // it's the same system that powers varDep.
      const cache = cacheSlot.getValue();
      if (cache) caches.add(cache);
      varDep(rv);
    }

    return value;
  };
}

type Broadcastable = InMemoryCache & {
  // This method is protected in InMemoryCache, which we are ignoring, but
  // we still want some semblance of type safety when we call it.
  broadcastWatches: InMemoryCache["broadcastWatches"];
};

function broadcast(cache: Broadcastable) {
  cache.broadcastWatches();
}
