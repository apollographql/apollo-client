import { Slot } from "@wry/context";
import { dep } from "optimism";
import { InMemoryCache } from "./inMemoryCache";
import { ApolloCache } from '../../core';

export interface ReactiveVar<T> {
  (newValue?: T): T;
  onNextChange(listener: ReactiveListener<T>): () => void;
}

export type ReactiveListener<T> = (value: T) => any;

const varDep = dep<ReactiveVar<any>>();

// Contextual Slot that acquires its value when custom read functions are
// called in Policies#readField.
export const cacheSlot = new Slot<ApolloCache<any>>();

// A listener function could in theory cause another listener to be added
// to the set while we're iterating over it, so it's important to commit
// to the original elements of the set before we begin iterating. See
// iterateObserversSafely for another example of this pattern.
function consumeAndIterate<T>(set: Set<T>, callback: (item: T) => any) {
  const items: T[] = [];
  set.forEach(item => items.push(item));
  set.clear();
  items.forEach(callback);
}

export function makeVar<T>(value: T): ReactiveVar<T> {
  const listeners = new Set<ReactiveListener<T>>();

  const rv: ReactiveVar<T> = function (newValue) {
    if (arguments.length > 0) {
      if (value !== newValue) {
        value = newValue!;
        varDep.dirty(rv);
        consumeAndIterate(listeners, listener => listener(value));
      }
    } else {
      // When reading from the variable, obtain the current cache from
      // context via cacheSlot. This isn't entirely foolproof, but it's
      // the same system that powers varDep.
      const cache = cacheSlot.getValue();
      if (cache && (cache as any).broadcastWatches) {
        listeners.add(() => broadcast(cache));
      }
      varDep(rv);
    }

    return value;
  };

  rv.onNextChange = listener => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return rv;
}

type Broadcastable = ApolloCache<any> & {
  // This method is protected in InMemoryCache, which we are ignoring, but
  // we still want some semblance of type safety when we call it.
  broadcastWatches?: InMemoryCache["broadcastWatches"];
};

function broadcast(cache: Broadcastable) {
  if (cache.broadcastWatches) {
    cache.broadcastWatches();
  }
}
