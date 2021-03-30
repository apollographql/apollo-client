// Make builtins like Map and Set safe to use with non-extensible objects.
import './fixPolyfills';

import { DocumentNode } from 'graphql';
import { wrap } from 'optimism';

import { ApolloCache, BatchOptions } from '../core/cache';
import { Cache } from '../core/types/Cache';
import { MissingFieldError } from '../core/types/common';
import {
  addTypenameToDocument,
  StoreObject,
  Reference,
  isReference,
} from '../../utilities';
import {
  ApolloReducerConfig,
  NormalizedCacheObject,
} from './types';
import { StoreReader } from './readFromStore';
import { StoreWriter } from './writeToStore';
import { EntityStore, supportsResultCaching } from './entityStore';
import { makeVar, forgetCache, recallCache } from './reactiveVars';
import {
  defaultDataIdFromObject,
  PossibleTypesMap,
  Policies,
  TypePolicies,
} from './policies';
import { hasOwn } from './helpers';

export interface InMemoryCacheConfig extends ApolloReducerConfig {
  resultCaching?: boolean;
  possibleTypes?: PossibleTypesMap;
  typePolicies?: TypePolicies;
}

type BroadcastOptions = Pick<
  BatchOptions<InMemoryCache>,
  | "onDirty"
  | "optimistic"
>

const defaultConfig: InMemoryCacheConfig = {
  dataIdFromObject: defaultDataIdFromObject,
  addTypename: true,
  resultCaching: true,
  typePolicies: {},
};

export class InMemoryCache extends ApolloCache<NormalizedCacheObject> {
  private data: EntityStore;
  private optimisticData: EntityStore;

  protected config: InMemoryCacheConfig;
  private watches = new Set<Cache.WatchOptions>();
  private addTypename: boolean;

  private typenameDocumentCache = new Map<DocumentNode, DocumentNode>();
  private storeReader: StoreReader;
  private storeWriter: StoreWriter;

  // Dynamically imported code can augment existing typePolicies or
  // possibleTypes by calling cache.policies.addTypePolicies or
  // cache.policies.addPossibletypes.
  public readonly policies: Policies;

  public readonly makeVar = makeVar;

  constructor(config: InMemoryCacheConfig = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.addTypename = !!this.config.addTypename;

    this.policies = new Policies({
      cache: this,
      dataIdFromObject: this.config.dataIdFromObject,
      possibleTypes: this.config.possibleTypes,
      typePolicies: this.config.typePolicies,
    });

    // Passing { resultCaching: false } in the InMemoryCache constructor options
    // will completely disable dependency tracking, which will improve memory
    // usage but worsen the performance of repeated reads.
    const rootStore = this.data = new EntityStore.Root({
      policies: this.policies,
      resultCaching: this.config.resultCaching,
    });

    // When no optimistic writes are currently active, cache.optimisticData ===
    // cache.data, so there are no additional layers on top of the actual data.
    // When an optimistic update happens, this.optimisticData will become a
    // linked list of EntityStore Layer objects that terminates with the
    // original this.data cache object.
    this.optimisticData = rootStore.stump;

    this.storeWriter = new StoreWriter(
      this,
      this.storeReader = new StoreReader({
        cache: this,
        addTypename: this.addTypename,
      }),
    );
  }

  public restore(data: NormalizedCacheObject): this {
    if (data) this.data.replace(data);
    return this;
  }

  public extract(optimistic: boolean = false): NormalizedCacheObject {
    return (optimistic ? this.optimisticData : this.data).extract();
  }

  public read<T>(options: Cache.ReadOptions): T | null {
    const {
      // Since read returns data or null, without any additional metadata
      // about whether/where there might have been missing fields, the
      // default behavior cannot be returnPartialData = true (like it is
      // for the diff method), since defaulting to true would violate the
      // integrity of the T in the return type. However, partial data may
      // be useful in some cases, so returnPartialData:true may be
      // specified explicitly.
      returnPartialData = false,
    } = options;
    try {
      return this.storeReader.diffQueryAgainstStore<T>({
        store: options.optimistic ? this.optimisticData : this.data,
        query: options.query,
        variables: options.variables,
        rootId: options.rootId,
        config: this.config,
        returnPartialData,
      }).result || null;
    } catch (e) {
      if (e instanceof MissingFieldError) {
        // Swallow MissingFieldError and return null, so callers do not
        // need to worry about catching "normal" exceptions resulting from
        // incomplete cache data. Unexpected errors will be re-thrown. If
        // you need more information about which fields were missing, use
        // cache.diff instead, and examine diffResult.missing.
        return null;
      }
      throw e;
    }
  }

  public write(options: Cache.WriteOptions): Reference | undefined {
    try {
      ++this.txCount;
      return this.storeWriter.writeToStore(this.data, options);
    } finally {
      if (!--this.txCount && options.broadcast !== false) {
        this.broadcastWatches();
      }
    }
  }

  public modify(options: Cache.ModifyOptions): boolean {
    if (hasOwn.call(options, "id") && !options.id) {
      // To my knowledge, TypeScript does not currently provide a way to
      // enforce that an optional property?:type must *not* be undefined
      // when present. That ability would be useful here, because we want
      // options.id to default to ROOT_QUERY only when no options.id was
      // provided. If the caller attempts to pass options.id with a
      // falsy/undefined value (perhaps because cache.identify failed), we
      // should not assume the goal was to modify the ROOT_QUERY object.
      // We could throw, but it seems natural to return false to indicate
      // that nothing was modified.
      return false;
    }
    const store = options.optimistic // Defaults to false.
      ? this.optimisticData
      : this.data;
    try {
      ++this.txCount;
      return store.modify(options.id || "ROOT_QUERY", options.fields);
    } finally {
      if (!--this.txCount && options.broadcast !== false) {
        this.broadcastWatches();
      }
    }
  }

  public diff<T>(options: Cache.DiffOptions): Cache.DiffResult<T> {
    return this.storeReader.diffQueryAgainstStore({
      store: options.optimistic ? this.optimisticData : this.data,
      rootId: options.id || "ROOT_QUERY",
      query: options.query,
      variables: options.variables,
      returnPartialData: options.returnPartialData,
      config: this.config,
    });
  }

  public watch(watch: Cache.WatchOptions): () => void {
    if (!this.watches.size) {
      // In case we previously called forgetCache(this) because
      // this.watches became empty (see below), reattach this cache to any
      // reactive variables on which it previously depended. It might seem
      // paradoxical that we're able to recall something we supposedly
      // forgot, but the point of calling forgetCache(this) is to silence
      // useless broadcasts while this.watches is empty, and to allow the
      // cache to be garbage collected. If, however, we manage to call
      // recallCache(this) here, this cache object must not have been
      // garbage collected yet, and should resume receiving updates from
      // reactive variables, now that it has a watcher to notify.
      recallCache(this);
    }
    this.watches.add(watch);
    if (watch.immediate) {
      this.maybeBroadcastWatch(watch);
    }
    return () => {
      // Once we remove the last watch from this.watches, cache.broadcastWatches
      // no longer does anything, so we preemptively tell the reactive variable
      // system to exclude this cache from future broadcasts.
      if (this.watches.delete(watch) && !this.watches.size) {
        forgetCache(this);
      }
      // Remove this watch from the LRU cache managed by the
      // maybeBroadcastWatch OptimisticWrapperFunction, to prevent memory
      // leaks involving the closure of watch.callback.
      this.maybeBroadcastWatch.forget(watch);
    };
  }

  // Request garbage collection of unreachable normalized entities.
  public gc() {
    return this.optimisticData.gc();
  }

  // Call this method to ensure the given root ID remains in the cache after
  // garbage collection, along with its transitive child entities. Note that
  // the cache automatically retains all directly written entities. By default,
  // the retainment persists after optimistic updates are removed. Pass true
  // for the optimistic argument if you would prefer for the retainment to be
  // discarded when the top-most optimistic layer is removed. Returns the
  // resulting (non-negative) retainment count.
  public retain(rootId: string, optimistic?: boolean): number {
    return (optimistic ? this.optimisticData : this.data).retain(rootId);
  }

  // Call this method to undo the effect of the retain method, above. Once the
  // retainment count falls to zero, the given ID will no longer be preserved
  // during garbage collection, though it may still be preserved by other safe
  // entities that refer to it. Returns the resulting (non-negative) retainment
  // count, in case that's useful.
  public release(rootId: string, optimistic?: boolean): number {
    return (optimistic ? this.optimisticData : this.data).release(rootId);
  }

  // Returns the canonical ID for a given StoreObject, obeying typePolicies
  // and keyFields (and dataIdFromObject, if you still use that). At minimum,
  // the object must contain a __typename and any primary key fields required
  // to identify entities of that type. If you pass a query result object, be
  // sure that none of the primary key fields have been renamed by aliasing.
  // If you pass a Reference object, its __ref ID string will be returned.
  public identify(object: StoreObject | Reference): string | undefined {
    return isReference(object) ? object.__ref :
      this.policies.identify(object)[0];
  }

  public evict(options: Cache.EvictOptions): boolean {
    if (!options.id) {
      if (hasOwn.call(options, "id")) {
        // See comment in modify method about why we return false when
        // options.id exists but is falsy/undefined.
        return false;
      }
      options = { ...options, id: "ROOT_QUERY" };
    }
    try {
      // It's unlikely that the eviction will end up invoking any other
      // cache update operations while it's running, but {in,de}crementing
      // this.txCount still seems like a good idea, for uniformity with
      // the other update methods.
      ++this.txCount;
      return this.optimisticData.evict(options);
    } finally {
      if (!--this.txCount && options.broadcast !== false) {
        this.broadcastWatches();
      }
    }
  }

  public reset(): Promise<void> {
    this.optimisticData = this.optimisticData.prune();
    this.data.clear();
    this.broadcastWatches();
    return Promise.resolve();
  }

  public removeOptimistic(idToRemove: string) {
    const newOptimisticData = this.optimisticData.removeLayer(idToRemove);
    if (newOptimisticData !== this.optimisticData) {
      this.optimisticData = newOptimisticData;
      this.broadcastWatches();
    }
  }

  private txCount = 0;

  public batch(options: BatchOptions<InMemoryCache>) {
    const {
      transaction,
      optimistic = true,
    } = options;

    const perform = (layer?: EntityStore) => {
      const { data, optimisticData } = this;
      ++this.txCount;
      if (layer) {
        this.data = this.optimisticData = layer;
      }
      try {
        transaction(this);
      } finally {
        --this.txCount;
        this.data = data;
        this.optimisticData = optimisticData;
      }
    };

    const { onDirty } = options;
    const alreadyDirty = new Set<Cache.WatchOptions>();

    if (onDirty && !this.txCount) {
      // If an options.onDirty callback is provided, we want to call it with
      // only the Cache.WatchOptions objects affected by options.transaction,
      // but there might be dirty watchers already waiting to be broadcast that
      // have nothing to do with the transaction. To prevent including those
      // watchers in the post-transaction broadcast, we perform this initial
      // broadcast to collect the dirty watchers, so we can re-dirty them later,
      // after the post-transaction broadcast, allowing them to receive their
      // pending broadcasts the next time broadcastWatches is called, just as
      // they would if we never called cache.batch.
      this.broadcastWatches({
        ...options,
        onDirty(watch) {
          alreadyDirty.add(watch);
          return false;
        },
      });
    }

    if (typeof optimistic === 'string') {
      // Note that there can be multiple layers with the same optimistic ID.
      // When removeOptimistic(id) is called for that id, all matching layers
      // will be removed, and the remaining layers will be reapplied.
      this.optimisticData = this.optimisticData.addLayer(optimistic, perform);
    } else if (optimistic === false) {
      // Ensure both this.data and this.optimisticData refer to the root
      // (non-optimistic) layer of the cache during the transaction. Note
      // that this.data could be a Layer if we are currently executing an
      // optimistic transaction function, but otherwise will always be an
      // EntityStore.Root instance.
      perform(this.data);
    } else {
      // Otherwise, leave this.data and this.optimisticData unchanged and
      // run the transaction with broadcast batching.
      perform();
    }

    // Note: if this.txCount > 0, then alreadyDirty.size === 0, so this code
    // takes the else branch and calls this.broadcastWatches(options), which
    // does nothing when this.txCount > 0.
    if (onDirty && alreadyDirty.size) {
      this.broadcastWatches({
        ...options,
        onDirty(watch, diff) {
          const onDirtyResult = onDirty.call(this, watch, diff);
          if (onDirtyResult !== false) {
            // Since onDirty did not return false, this diff is about to be
            // broadcast to watch.callback, so we don't need to re-dirty it
            // with the other alreadyDirty watches below.
            alreadyDirty.delete(watch);
          }
          return onDirtyResult;
        }
      });
      // Silently re-dirty any watches that were already dirty before the
      // transaction was performed, and were not broadcast just now.
      if (alreadyDirty.size) {
        alreadyDirty.forEach(watch => this.maybeBroadcastWatch.dirty(watch));
      }
    } else {
      // If alreadyDirty is empty or we don't have an options.onDirty function,
      // we don't need to go to the trouble of wrapping options.onDirty.
      this.broadcastWatches(options);
    }
  }

  public performTransaction(
    transaction: (cache: InMemoryCache) => any,
    optimisticId?: string | null,
  ) {
    return this.batch({
      transaction,
      optimistic: optimisticId || (optimisticId !== null),
    });
  }

  public transformDocument(document: DocumentNode): DocumentNode {
    if (this.addTypename) {
      let result = this.typenameDocumentCache.get(document);
      if (!result) {
        result = addTypenameToDocument(document);
        this.typenameDocumentCache.set(document, result);
        // If someone calls transformDocument and then mistakenly passes the
        // result back into an API that also calls transformDocument, make sure
        // we don't keep creating new query documents.
        this.typenameDocumentCache.set(result, result);
      }
      return result;
    }
    return document;
  }

  protected broadcastWatches(options?: BroadcastOptions) {
    if (!this.txCount) {
      this.watches.forEach(c => this.maybeBroadcastWatch(c, options));
    }
  }

  private maybeBroadcastWatch = wrap((
    c: Cache.WatchOptions,
    options?: BroadcastOptions,
  ) => {
    return this.broadcastWatch(c, options);
  }, {
    makeCacheKey: (c: Cache.WatchOptions) => {
      // Return a cache key (thus enabling result caching) only if we're
      // currently using a data store that can track cache dependencies.
      const store = c.optimistic ? this.optimisticData : this.data;
      if (supportsResultCaching(store)) {
        const { optimistic, rootId, variables } = c;
        return store.makeCacheKey(
          c.query,
          // Different watches can have the same query, optimistic
          // status, rootId, and variables, but if their callbacks are
          // different, the (identical) result needs to be delivered to
          // each distinct callback. The easiest way to achieve that
          // separation is to include c.callback in the cache key for
          // maybeBroadcastWatch calls. See issue #5733.
          c.callback,
          JSON.stringify({ optimistic, rootId, variables }),
        );
      }
    }
  });

  // This method is wrapped by maybeBroadcastWatch, which is called by
  // broadcastWatches, so that we compute and broadcast results only when
  // the data that would be broadcast might have changed. It would be
  // simpler to check for changes after recomputing a result but before
  // broadcasting it, but this wrapping approach allows us to skip both
  // the recomputation and the broadcast, in most cases.
  private broadcastWatch(
    c: Cache.WatchOptions,
    options?: BroadcastOptions,
  ) {
    const diff = this.diff<any>({
      query: c.query,
      variables: c.variables,
      optimistic: c.optimistic,
    });

    if (options) {
      if (c.optimistic &&
          typeof options.optimistic === "string") {
        diff.fromOptimisticTransaction = true;
      }

      if (options.onDirty &&
          options.onDirty.call(this, c, diff) === false) {
        // Returning false from the onDirty callback will prevent calling
        // c.callback(diff) for this watcher.
        return;
      }
    }

    if (!c.lastDiff || c.lastDiff.result !== diff.result) {
      c.callback(c.lastDiff = diff);
    }
  }
}
