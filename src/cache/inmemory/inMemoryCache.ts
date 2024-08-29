import { invariant } from "../../utilities/globals/index.js";

// Make builtins like Map and Set safe to use with non-extensible objects.
import "./fixPolyfills.js";

import type { DocumentNode } from "graphql";
import { wrap } from "optimism";
import { equal } from "@wry/equality";

import { ApolloCache } from "../core/cache.js";
import type { Cache } from "../core/types/Cache.js";
import { MissingFieldError } from "../core/types/common.js";
import type { StoreObject, Reference } from "../../utilities/index.js";
import {
  addTypenameToDocument,
  isReference,
  DocumentTransform,
  canonicalStringify,
  print,
  cacheSizes,
  defaultCacheSizes,
} from "../../utilities/index.js";
import type { InMemoryCacheConfig, NormalizedCacheObject } from "./types.js";
import { StoreReader } from "./readFromStore.js";
import { StoreWriter } from "./writeToStore.js";
import { EntityStore, supportsResultCaching } from "./entityStore.js";
import { makeVar, forgetCache, recallCache } from "./reactiveVars.js";
import { Policies } from "./policies.js";
import { hasOwn, normalizeConfig, shouldCanonizeResults } from "./helpers.js";
import type { OperationVariables } from "../../core/index.js";
import { getInMemoryCacheMemoryInternals } from "../../utilities/caching/getMemoryInternals.js";
import type { FragmentRegistryAPI } from "./fragmentRegistry.js";
import type {
  BroadcastOptions,
  MaybeBroadcastWatch,
  PrivateParts,
} from "./privates.js";
import { $, privateParts } from "./privates.js";

function getMaybeBroadcastWatch(
  resultCacheMaxSize: number,
  cache: InMemoryCache
): MaybeBroadcastWatch {
  return wrap(
    (c: Cache.WatchOptions, options?: BroadcastOptions) => {
      return cache.broadcastWatch(c, options);
    },
    {
      max: resultCacheMaxSize,
      makeCacheKey: (c: Cache.WatchOptions) => {
        // Return a cache key (thus enabling result caching) only if we're
        // currently using a data store that can track cache dependencies.
        const { optimisticData, data } = $(cache);
        const store = c.optimistic ? optimisticData : data;
        if (supportsResultCaching(store)) {
          const { optimistic, id, variables } = c;
          return store.makeCacheKey(
            c.query,
            // Different watches can have the same query, optimistic
            // status, rootId, and variables, but if their callbacks are
            // different, the (identical) result needs to be delivered to
            // each distinct callback. The easiest way to achieve that
            // separation is to include c.callback in the cache key for
            // maybeBroadcastWatch calls. See issue #5733.
            c.callback,
            canonicalStringify({ optimistic, id, variables })
          );
        }
      },
    }
  );
}

function getStoreReader(
  cache: InMemoryCache,
  addTypename: boolean,
  resultCacheMaxSize: number | undefined,
  canonizeResults: boolean,
  resetResultIdentities: boolean | undefined,
  previousReader: StoreReader | undefined,
  fragments: FragmentRegistryAPI | undefined
) {
  return new StoreReader({
    cache,
    addTypename,
    resultCacheMaxSize,
    canonizeResults,
    canon:
      resetResultIdentities ? void 0 : previousReader && previousReader.canon,
    fragments,
  });
}

export class InMemoryCache extends ApolloCache<NormalizedCacheObject> {
  // Override the default value, since InMemoryCache result objects are frozen
  // in development and expected to remain logically immutable in production.
  public readonly assumeImmutableResults = true;

  // Dynamically imported code can augment existing typePolicies or
  // possibleTypes by calling cache.policies.addTypePolicies or
  // cache.policies.addPossibletypes.
  public readonly policies: Policies;

  public readonly makeVar = makeVar;

  constructor(options: InMemoryCacheConfig = {}) {
    super();
    const cache = this;
    const config = normalizeConfig(options);
    const {
      typePolicies,
      resultCaching,
      fragments,
      dataIdFromObject,
      possibleTypes,
      addTypename,
      resultCacheMaxSize,
    } = config;
    const max =
      resultCacheMaxSize ||
      cacheSizes["inMemoryCache.maybeBroadcastWatch"] ||
      defaultCacheSizes["inMemoryCache.maybeBroadcastWatch"];
    const canonizeResults = shouldCanonizeResults(config);

    const policies = (this.policies = new Policies({
      cache,
      dataIdFromObject,
      possibleTypes,
      typePolicies,
    }));

    const data = new EntityStore.Root({
      policies,
      resultCaching,
    });
    const optimisticData = data.stump;

    const storeReader = getStoreReader(
      cache,
      addTypename,
      resultCacheMaxSize,
      canonizeResults,
      false,
      undefined,
      fragments
    );

    const storeWriter = new StoreWriter(cache, storeReader, fragments);

    const maybeBroadcastWatch = getMaybeBroadcastWatch(max, cache);

    const privates: PrivateParts = {
      txCount: 0,
      data,
      optimisticData,
      storeReader,
      storeWriter,
      maybeBroadcastWatch,
      config,
      addTypename,
      watches: new Set<Cache.WatchOptions>(),
      addTypenameTransform: new DocumentTransform(addTypenameToDocument),
      init() {
        // Passing { resultCaching: false } in the InMemoryCache constructor options
        // will completely disable dependency tracking, which will improve memory
        // usage but worsen the performance of repeated reads.
        const rootStore = (this.data = new EntityStore.Root({
          policies,
          resultCaching,
        }));

        // When no optimistic writes are currently active, cache.optimisticData ===
        // cache.data, so there are no additional layers on top of the actual data.
        // When an optimistic update happens, this.optimisticData will become a
        // linked list of EntityStore Layer objects that terminates with the
        // original this.data cache object.
        this.optimisticData = rootStore.stump;

        this.resetResultCache();
      },
      resetResultCache(resetResultIdentities?: boolean) {
        const previousReader = this.storeReader;
        const { fragments } = config;

        // The StoreWriter is mostly stateless and so doesn't really need to be
        // reset, but it does need to have its writer.storeReader reference updated,
        // so it's simpler to update this.storeWriter as well.
        const storeReader = (this.storeReader = getStoreReader(
          cache,
          addTypename,
          resultCacheMaxSize,
          canonizeResults,
          resetResultIdentities,
          previousReader,
          fragments
        ));
        this.storeWriter = new StoreWriter(cache, storeReader, fragments);
        this.maybeBroadcastWatch = getMaybeBroadcastWatch(max, cache);

        // Since we have thrown away all the cached functions that depend on the
        // CacheGroup dependencies maintained by EntityStore, we should also reset
        // all CacheGroup dependency information.
        new Set([this.data.group, this.optimisticData.group]).forEach((group) =>
          group.resetCaching()
        );
      },
    };
    privateParts.set(this, privates);
    privates.init();
  }

  public restore(data: NormalizedCacheObject): this {
    const _ = $(this);
    _.init();
    // Since calling this.init() discards/replaces the entire StoreReader, along
    // with the result caches it maintains, this.data.replace(data) won't have
    // to bother deleting the old data.
    if (data) _.data.replace(data);
    return this;
  }

  public extract(optimistic: boolean = false): NormalizedCacheObject {
    const _ = $(this);
    return (optimistic ? _.optimisticData : _.data).extract();
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
      const _ = $(this);
      return (
        _.storeReader.diffQueryAgainstStore<T>({
          ...options,
          store: options.optimistic ? _.optimisticData : _.data,
          config: _.config,
          returnPartialData,
        }).result || null
      );
    } catch (e) {
      if (e instanceof MissingFieldError) {
        // Swallow MissingFieldError and return null, so callers do not need to
        // worry about catching "normal" exceptions resulting from incomplete
        // cache data. Unexpected errors will be re-thrown. If you need more
        // information about which fields were missing, use cache.diff instead,
        // and examine diffResult.missing.
        return null;
      }
      throw e;
    }
  }

  public write(options: Cache.WriteOptions): Reference | undefined {
    const _ = $(this);
    try {
      ++_.txCount;
      return _.storeWriter.writeToStore(_.data, options);
    } finally {
      if (!--_.txCount && options.broadcast !== false) {
        this.broadcastWatches();
      }
    }
  }

  public modify<Entity extends Record<string, any> = Record<string, any>>(
    options: Cache.ModifyOptions<Entity>
  ): boolean {
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
    const _ = $(this);
    const store =
      (
        options.optimistic // Defaults to false.
      ) ?
        _.optimisticData
      : _.data;
    try {
      ++_.txCount;
      return store.modify(options.id || "ROOT_QUERY", options.fields);
    } finally {
      if (!--_.txCount && options.broadcast !== false) {
        this.broadcastWatches();
      }
    }
  }

  public diff<TData, TVariables extends OperationVariables = any>(
    options: Cache.DiffOptions<TData, TVariables>
  ): Cache.DiffResult<TData> {
    const _ = $(this);
    return _.storeReader.diffQueryAgainstStore({
      ...options,
      store: options.optimistic ? _.optimisticData : _.data,
      rootId: options.id || "ROOT_QUERY",
      config: _.config,
    });
  }

  public watch<TData = any, TVariables = any>(
    watch: Cache.WatchOptions<TData, TVariables>
  ): () => void {
    const _ = $(this);
    if (!_.watches.size) {
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
    _.watches.add(watch);
    if (watch.immediate) {
      _.maybeBroadcastWatch(watch);
    }
    return () => {
      // Once we remove the last watch from this.watches, cache.broadcastWatches
      // no longer does anything, so we preemptively tell the reactive variable
      // system to exclude this cache from future broadcasts.
      if (_.watches.delete(watch) && !_.watches.size) {
        forgetCache(this);
      }
      // Remove this watch from the LRU cache managed by the
      // maybeBroadcastWatch OptimisticWrapperFunction, to prevent memory
      // leaks involving the closure of watch.callback.
      _.maybeBroadcastWatch.forget(watch);
    };
  }

  public gc(options?: {
    // If true, also free non-essential result cache memory by bulk-releasing
    // this.{store{Reader,Writer},maybeBroadcastWatch}. Defaults to false.
    resetResultCache?: boolean;
    // If resetResultCache is true, this.storeReader.canon will be preserved by
    // default, but can also be discarded by passing resetResultIdentities:true.
    // Defaults to false.
    resetResultIdentities?: boolean;
  }) {
    canonicalStringify.reset();
    print.reset();
    const _ = $(this);
    _.addTypenameTransform.resetCache();
    _.config.fragments?.resetCaches();
    const ids = _.optimisticData.gc();
    if (options && !_.txCount) {
      if (options.resetResultCache) {
        _.resetResultCache(options.resetResultIdentities);
      } else if (options.resetResultIdentities) {
        _.storeReader.resetCanon();
      }
    }
    return ids;
  }

  // Call this method to ensure the given root ID remains in the cache after
  // garbage collection, along with its transitive child entities. Note that
  // the cache automatically retains all directly written entities. By default,
  // the retainment persists after optimistic updates are removed. Pass true
  // for the optimistic argument if you would prefer for the retainment to be
  // discarded when the top-most optimistic layer is removed. Returns the
  // resulting (non-negative) retainment count.
  public retain(rootId: string, optimistic?: boolean): number {
    const _ = $(this);
    return (optimistic ? _.optimisticData : _.data).retain(rootId);
  }

  // Call this method to undo the effect of the retain method, above. Once the
  // retainment count falls to zero, the given ID will no longer be preserved
  // during garbage collection, though it may still be preserved by other safe
  // entities that refer to it. Returns the resulting (non-negative) retainment
  // count, in case that's useful.
  public release(rootId: string, optimistic?: boolean): number {
    const _ = $(this);
    return (optimistic ? _.optimisticData : _.data).release(rootId);
  }

  // Returns the canonical ID for a given StoreObject, obeying typePolicies
  // and keyFields (and dataIdFromObject, if you still use that). At minimum,
  // the object must contain a __typename and any primary key fields required
  // to identify entities of that type. If you pass a query result object, be
  // sure that none of the primary key fields have been renamed by aliasing.
  // If you pass a Reference object, its __ref ID string will be returned.
  public identify(object: StoreObject | Reference): string | undefined {
    if (isReference(object)) return object.__ref;
    try {
      return this.policies.identify(object)[0];
    } catch (e) {
      invariant.warn(e);
    }
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
    const _ = $(this);
    try {
      // It's unlikely that the eviction will end up invoking any other
      // cache update operations while it's running, but {in,de}crementing
      // this.txCount still seems like a good idea, for uniformity with
      // the other update methods.
      ++_.txCount;
      // Pass this.data as a limit on the depth of the eviction, so evictions
      // during optimistic updates (when this.data is temporarily set equal to
      // this.optimisticData) do not escape their optimistic Layer.
      return _.optimisticData.evict(options, _.data);
    } finally {
      if (!--_.txCount && options.broadcast !== false) {
        this.broadcastWatches();
      }
    }
  }

  public reset(options?: Cache.ResetOptions): Promise<void> {
    const _ = $(this);
    _.init();

    canonicalStringify.reset();

    if (options && options.discardWatches) {
      // Similar to what happens in the unsubscribe function returned by
      // cache.watch, applied to all current watches.
      _.watches.forEach((watch) => _.maybeBroadcastWatch.forget(watch));
      _.watches.clear();
      forgetCache(this);
    } else {
      // Calling this.init() above unblocks all maybeBroadcastWatch caching, so
      // this.broadcastWatches() triggers a broadcast to every current watcher
      // (letting them know their data is now missing). This default behavior is
      // convenient because it means the watches do not have to be manually
      // reestablished after resetting the cache. To prevent this broadcast and
      // cancel all watches, pass true for options.discardWatches.
      this.broadcastWatches();
    }

    return Promise.resolve();
  }

  public removeOptimistic(idToRemove: string) {
    const _ = $(this);
    const newOptimisticData = _.optimisticData.removeLayer(idToRemove);
    if (newOptimisticData !== _.optimisticData) {
      _.optimisticData = newOptimisticData;
      this.broadcastWatches();
    }
  }

  public batch<TUpdateResult>(
    options: Cache.BatchOptions<
      ApolloCache<NormalizedCacheObject>,
      TUpdateResult
    >
  ): TUpdateResult {
    const {
      update,
      optimistic = true,
      removeOptimistic,
      onWatchUpdated,
    } = options;

    let updateResult: TUpdateResult;
    const _ = $(this);
    const perform = (layer?: EntityStore): TUpdateResult => {
      const { data, optimisticData } = _;
      ++_.txCount;
      if (layer) {
        _.data = _.optimisticData = layer;
      }
      try {
        return (updateResult = update(this));
      } finally {
        --_.txCount;
        _.data = data;
        _.optimisticData = optimisticData;
      }
    };

    const alreadyDirty = new Set<Cache.WatchOptions>();

    if (onWatchUpdated && !_.txCount) {
      // If an options.onWatchUpdated callback is provided, we want to call it
      // with only the Cache.WatchOptions objects affected by options.update,
      // but there might be dirty watchers already waiting to be broadcast that
      // have nothing to do with the update. To prevent including those watchers
      // in the post-update broadcast, we perform this initial broadcast to
      // collect the dirty watchers, so we can re-dirty them later, after the
      // post-update broadcast, allowing them to receive their pending
      // broadcasts the next time broadcastWatches is called, just as they would
      // if we never called cache.batch.
      this.broadcastWatches({
        ...options,
        onWatchUpdated(watch) {
          alreadyDirty.add(watch);
          return false;
        },
      });
    }

    if (typeof optimistic === "string") {
      // Note that there can be multiple layers with the same optimistic ID.
      // When removeOptimistic(id) is called for that id, all matching layers
      // will be removed, and the remaining layers will be reapplied.
      _.optimisticData = _.optimisticData.addLayer(optimistic, perform);
    } else if (optimistic === false) {
      // Ensure both this.data and this.optimisticData refer to the root
      // (non-optimistic) layer of the cache during the update. Note that
      // this.data could be a Layer if we are currently executing an optimistic
      // update function, but otherwise will always be an EntityStore.Root
      // instance.
      perform(_.data);
    } else {
      // Otherwise, leave this.data and this.optimisticData unchanged and run
      // the update with broadcast batching.
      perform();
    }

    if (typeof removeOptimistic === "string") {
      _.optimisticData = _.optimisticData.removeLayer(removeOptimistic);
    }

    // Note: if this.txCount > 0, then alreadyDirty.size === 0, so this code
    // takes the else branch and calls this.broadcastWatches(options), which
    // does nothing when this.txCount > 0.
    if (onWatchUpdated && alreadyDirty.size) {
      this.broadcastWatches({
        ...options,
        onWatchUpdated(watch, diff) {
          const result = onWatchUpdated.call(this, watch, diff);
          if (result !== false) {
            // Since onWatchUpdated did not return false, this diff is
            // about to be broadcast to watch.callback, so we don't need
            // to re-dirty it with the other alreadyDirty watches below.
            alreadyDirty.delete(watch);
          }
          return result;
        },
      });
      // Silently re-dirty any watches that were already dirty before the update
      // was performed, and were not broadcast just now.
      if (alreadyDirty.size) {
        alreadyDirty.forEach((watch) => _.maybeBroadcastWatch.dirty(watch));
      }
    } else {
      // If alreadyDirty is empty or we don't have an onWatchUpdated
      // function, we don't need to go to the trouble of wrapping
      // options.onWatchUpdated.
      this.broadcastWatches(options);
    }

    return updateResult!;
  }

  public performTransaction(
    update: (cache: ApolloCache<NormalizedCacheObject>) => any,
    optimisticId?: string | null
  ) {
    return this.batch({
      update,
      optimistic: optimisticId || optimisticId !== null,
    });
  }

  public transformDocument(document: DocumentNode): DocumentNode {
    return this.addTypenameToDocument(this.addFragmentsToDocument(document));
  }

  broadcastWatches(options?: BroadcastOptions) {
    const _ = $(this);
    if (!_.txCount) {
      _.watches.forEach((c) => _.maybeBroadcastWatch(c, options));
    }
  }

  addFragmentsToDocument(document: DocumentNode) {
    const { fragments } = $(this).config;
    return fragments ? fragments.transform(document) : document;
  }

  addTypenameToDocument(document: DocumentNode) {
    const _ = $(this);
    if (_.addTypename) {
      return _.addTypenameTransform.transformDocument(document);
    }
    return document;
  }

  // This method is wrapped by maybeBroadcastWatch, which is called by
  // broadcastWatches, so that we compute and broadcast results only when
  // the data that would be broadcast might have changed. It would be
  // simpler to check for changes after recomputing a result but before
  // broadcasting it, but this wrapping approach allows us to skip both
  // the recomputation and the broadcast, in most cases.
  broadcastWatch(c: Cache.WatchOptions, options?: BroadcastOptions) {
    const { lastDiff } = c;

    // Both WatchOptions and DiffOptions extend ReadOptions, and DiffOptions
    // currently requires no additional properties, so we can use c (a
    // WatchOptions object) as DiffOptions, without having to allocate a new
    // object, and without having to enumerate the relevant properties (query,
    // variables, etc.) explicitly. There will be some additional properties
    // (lastDiff, callback, etc.), but cache.diff ignores them.
    const diff = this.diff<any>(c);

    if (options) {
      if (c.optimistic && typeof options.optimistic === "string") {
        diff.fromOptimisticTransaction = true;
      }

      if (
        options.onWatchUpdated &&
        options.onWatchUpdated.call(this, c, diff, lastDiff) === false
      ) {
        // Returning false from the onWatchUpdated callback will prevent
        // calling c.callback(diff) for this watcher.
        return;
      }
    }

    if (!lastDiff || !equal(lastDiff.result, diff.result)) {
      c.callback((c.lastDiff = diff), lastDiff);
    }
  }

  /**
   * @experimental
   * @internal
   * This is not a stable API - it is used in development builds to expose
   * information to the DevTools.
   * Use at your own risk!
   */
  public getMemoryInternals?: typeof getInMemoryCacheMemoryInternals;
}

if (__DEV__) {
  InMemoryCache.prototype.getMemoryInternals = getInMemoryCacheMemoryInternals;
}
