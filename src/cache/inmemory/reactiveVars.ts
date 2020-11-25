import { Slot } from "@wry/context";
import { dep } from "optimism";
import { InMemoryCache } from "./inMemoryCache";
import { ApolloCache } from '../../core';

export interface ReactiveVar<T> {
  (newValue?: T): T;
  onNextChange(listener: ReactiveListener<T>): () => void;
  attachCache(cache: ApolloCache<any>): this;
  forgetCache(cache: ApolloCache<any>): boolean;
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
  if (set.size) {
    const items: T[] = [];
    set.forEach(item => items.push(item));
    set.clear();
    items.forEach(callback);
  }
}

const varsByCache = new WeakMap<ApolloCache<any>, Set<ReactiveVar<any>>>();

export function forgetCache(cache: ApolloCache<any>) {
  const vars = varsByCache.get(cache);
  if (vars) {
    consumeAndIterate(vars, rv => rv.forgetCache(cache));
    varsByCache.delete(cache);
  }
}

export function makeVar<T>(value: T): ReactiveVar<T> {
  const caches = new Set<ApolloCache<any>>();
  const listeners = new Set<ReactiveListener<T>>();

  const rv: ReactiveVar<T> = function (newValue) {
    if (arguments.length > 0) {
      if (value !== newValue) {
        value = newValue!;
        // First, invalidate any fields with custom read functions that
        // consumed this variable, so query results involving those fields
        // will be recomputed the next time we read them.
        varDep.dirty(rv);
        // Next, broadcast changes to any caches that have previously read
        // from this variable.
        caches.forEach(broadcast);
        // Finally, notify any listeners added via rv.onNextChange.
        consumeAndIterate(listeners, listener => listener(value));
      }
    } else {
      // When reading from the variable, obtain the current cache from
      // context via cacheSlot. This isn't entirely foolproof, but it's
      // the same system that powers varDep.
      const cache = cacheSlot.getValue();
      if (cache) attach(cache);
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

  const attach = rv.attachCache = cache => {
    caches.add(cache);
    let vars = varsByCache.get(cache)!;
    if (!vars) varsByCache.set(cache, vars = new Set);
    vars.add(rv);
    return rv;
  };

  rv.forgetCache = cache => {
    const deleted = caches.delete(cache);
    if (deleted) {
      const vars = varsByCache.get(cache);
      if (vars) vars.delete(rv);
    }
    return deleted;
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
