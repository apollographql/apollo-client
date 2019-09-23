// Make builtins like Map and Set safe to use with non-extensible objects.
import './fixPolyfills';

import { DocumentNode } from 'graphql';
import { wrap } from 'optimism';
import { KeyTrie } from 'optimism';

import { ApolloCache, Transaction } from '../core/cache';
import { Cache } from '../core/types/Cache';
import { addTypenameToDocument } from '../../utilities/graphql/transform';
import { canUseWeakMap } from '../../utilities/common/canUse';
import {
  ApolloReducerConfig,
  NormalizedCacheObject,
} from './types';
import { StoreReader } from './readFromStore';
import { StoreWriter } from './writeToStore';
import { EntityCache, supportsResultCaching } from './entityCache';
import {
  defaultDataIdFromObject,
  PossibleTypesMap,
  Policies,
  TypePolicies,
} from './policies';

export interface InMemoryCacheConfig extends ApolloReducerConfig {
  resultCaching?: boolean;
  possibleTypes?: PossibleTypesMap;
  typePolicies?: TypePolicies;
}

const defaultConfig: InMemoryCacheConfig = {
  dataIdFromObject: defaultDataIdFromObject,
  addTypename: true,
  resultCaching: true,
  typePolicies: {},
};

export class InMemoryCache extends ApolloCache<NormalizedCacheObject> {
  private data: EntityCache;
  private optimisticData: EntityCache;

  protected config: InMemoryCacheConfig;
  private watches = new Set<Cache.WatchOptions>();
  private addTypename: boolean;
  private policies: Policies;

  private typenameDocumentCache = new Map<DocumentNode, DocumentNode>();
  private storeReader: StoreReader;
  private storeWriter: StoreWriter;
  private cacheKeyRoot = new KeyTrie<object>(canUseWeakMap);

  // Set this while in a transaction to prevent broadcasts...
  // don't forget to turn it back on!
  private silenceBroadcast: boolean = false;

  constructor(config: InMemoryCacheConfig = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.addTypename = !!this.config.addTypename;

    this.policies = new Policies({
      dataIdFromObject: this.config.dataIdFromObject,
      possibleTypes: this.config.possibleTypes,
      typePolicies: this.config.typePolicies,
    });

    // Passing { resultCaching: false } in the InMemoryCache constructor options
    // will completely disable dependency tracking, which will improve memory
    // usage but worsen the performance of repeated reads.
    this.data = new EntityCache.Root({
      resultCaching: this.config.resultCaching,
    });

    // When no optimistic writes are currently active, cache.optimisticData ===
    // cache.data, so there are no additional layers on top of the actual data.
    // When an optimistic update happens, this.optimisticData will become a
    // linked list of OptimisticCacheLayer objects that terminates with the
    // original this.data cache object.
    this.optimisticData = this.data;

    this.storeWriter = new StoreWriter({
      policies: this.policies,
    });

    this.storeReader = new StoreReader({
      addTypename: this.addTypename,
      cacheKeyRoot: this.cacheKeyRoot,
      policies: this.policies,
    });

    const cache = this;
    const { maybeBroadcastWatch } = cache;
    this.maybeBroadcastWatch = wrap((c: Cache.WatchOptions) => {
      return maybeBroadcastWatch.call(this, c);
    }, {
      makeCacheKey(c: Cache.WatchOptions) {
        if (c.previousResult) {
          // If a previousResult was provided, assume the caller would prefer
          // to compare the previous data to the new data to determine whether
          // to broadcast, so we should disable caching by returning here, to
          // give maybeBroadcastWatch a chance to do that comparison.
          return;
        }

        if (supportsResultCaching(cache.data)) {
          // Return a cache key (thus enabling caching) only if we're currently
          // using a data store that can track cache dependencies.
          return cache.cacheKeyRoot.lookup(
            c.query,
            JSON.stringify(c.variables),
          );
        }
      }
    });
  }

  public restore(data: NormalizedCacheObject): this {
    if (data) this.data.replace(data);
    return this;
  }

  public extract(optimistic: boolean = false): NormalizedCacheObject {
    return (optimistic ? this.optimisticData : this.data).toObject();
  }

  public read<T>(options: Cache.ReadOptions): T | null {
    if (typeof options.rootId === 'string' &&
        typeof this.data.get(options.rootId) === 'undefined') {
      return null;
    }

    return this.storeReader.readQueryFromStore({
      store: options.optimistic ? this.optimisticData : this.data,
      query: options.query,
      variables: options.variables,
      rootId: options.rootId,
      previousResult: options.previousResult,
      config: this.config,
    }) || null;
  }

  public write(options: Cache.WriteOptions): void {
    this.storeWriter.writeQueryToStore({
      store: this.data,
      query: options.query,
      result: options.result,
      dataId: options.dataId,
      variables: options.variables,
    });

    this.broadcastWatches();
  }

  public diff<T>(options: Cache.DiffOptions): Cache.DiffResult<T> {
    return this.storeReader.diffQueryAgainstStore({
      store: options.optimistic ? this.optimisticData : this.data,
      query: options.query,
      variables: options.variables,
      returnPartialData: options.returnPartialData,
      previousResult: options.previousResult,
      config: this.config,
    });
  }

  public watch(watch: Cache.WatchOptions): () => void {
    this.watches.add(watch);

    return () => {
      this.watches.delete(watch);
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

  public evict(dataId: string): boolean {
    if (this.optimisticData.has(dataId)) {
      // Note that this deletion does not trigger a garbage collection, which
      // is convenient in cases where you want to evict multiple entities before
      // performing a single garbage collection.
      this.optimisticData.delete(dataId);
      return !this.optimisticData.has(dataId);
    }
    return false;
  }

  public reset(): Promise<void> {
    this.data.clear();
    this.optimisticData = this.data;
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

  public performTransaction(
    transaction: Transaction<NormalizedCacheObject>,
    // This parameter is not part of the performTransaction signature inherited
    // from the ApolloCache abstract class, but it's useful because it saves us
    // from duplicating this implementation in recordOptimisticTransaction.
    optimisticId?: string,
  ) {
    const perform = (layer?: EntityCache) => {
      const { data, optimisticData, silenceBroadcast } = this;
      this.silenceBroadcast = true;
      // Temporarily make this.data refer to the new layer for the duration of
      // the transaction.
      if (layer) {
        this.data = this.optimisticData = layer;
      }
      try {
        return transaction(this);
      } finally {
        this.silenceBroadcast = silenceBroadcast;
        if (layer) {
          this.data = data;
          this.optimisticData = optimisticData;
        }
      }
    };

    if (typeof optimisticId === 'string') {
      // Note that there can be multiple layers with the same optimisticId.
      // When removeOptimistic(id) is called for that id, all matching layers
      // will be removed, and the remaining layers will be reapplied.
      this.optimisticData = this.optimisticData.addLayer(optimisticId, perform);
    } else {
      // If we don't have an optimisticId, perform the transaction anyway. Note
      // that this.optimisticData.addLayer calls perform, too.
      perform();
    }

    // This broadcast does nothing if this.silenceBroadcast is true.
    this.broadcastWatches();
  }

  public recordOptimisticTransaction(
    transaction: Transaction<NormalizedCacheObject>,
    id: string,
  ) {
    return this.performTransaction(transaction, id);
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

  protected broadcastWatches() {
    if (!this.silenceBroadcast) {
      this.watches.forEach(c => this.maybeBroadcastWatch(c));
    }
  }

  // This method is wrapped in the constructor so that it will be called only
  // if the data that would be broadcast has changed.
  private maybeBroadcastWatch(c: Cache.WatchOptions) {
    c.callback(
      this.diff({
        query: c.query,
        variables: c.variables,
        previousResult: c.previousResult && c.previousResult(),
        optimistic: c.optimistic,
      }),
    );
  }
}
