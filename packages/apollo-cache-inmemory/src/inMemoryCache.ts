// Make builtins like Map and Set safe to use with non-extensible objects.
import './fixPolyfills';

import { DocumentNode } from 'graphql';
import { Cache, ApolloCache, Transaction } from 'apollo-cache';
import { addTypenameToDocument, canUseWeakMap } from 'apollo-utilities';
import { wrap } from 'optimism';
import { InvariantError } from 'ts-invariant';

import {
  ApolloReducerConfig,
  NormalizedCacheObject,
  PossibleTypesMap,
} from './types';

import { StoreReader } from './readFromStore';
import { StoreWriter } from './writeToStore';
import { EntityCache, supportsResultCaching } from './entityCache';
import { KeyTrie } from 'optimism';

export interface InMemoryCacheConfig extends ApolloReducerConfig {
  resultCaching?: boolean;
}

const defaultConfig: InMemoryCacheConfig = {
  dataIdFromObject: defaultDataIdFromObject,
  addTypename: true,
  resultCaching: true,
};

export function defaultDataIdFromObject(result: any): string | null {
  if (result.__typename) {
    if (result.id !== undefined) {
      return `${result.__typename}:${result.id}`;
    }
    if (result._id !== undefined) {
      return `${result.__typename}:${result._id}`;
    }
  }
  return null;
}

export class InMemoryCache extends ApolloCache<NormalizedCacheObject> {
  private data: EntityCache;
  private optimisticData: EntityCache;

  protected config: InMemoryCacheConfig;
  private watches = new Set<Cache.WatchOptions>();
  private addTypename: boolean;
  private possibleTypes?: {
    [supertype: string]: {
      [subtype: string]: true;
    };
  };
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

    if (this.config.possibleTypes) {
      this.addPossibleTypes(this.config.possibleTypes);
    }

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
      possibleTypes: this.possibleTypes,
    });

    this.storeReader = new StoreReader({
      cacheKeyRoot: this.cacheKeyRoot,
      possibleTypes: this.possibleTypes,
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
      query: this.transformDocument(options.query),
      variables: options.variables,
      rootId: options.rootId,
      previousResult: options.previousResult,
      config: this.config,
    }) || null;
  }

  public write(write: Cache.WriteOptions): void {
    this.storeWriter.writeQueryToStore({
      store: this.data,
      query: this.transformDocument(write.query),
      result: write.result,
      dataId: write.dataId,
      variables: write.variables,
      dataIdFromObject: this.config.dataIdFromObject,
    });

    this.broadcastWatches();
  }

  public diff<T>(query: Cache.DiffOptions): Cache.DiffResult<T> {
    return this.storeReader.diffQueryAgainstStore({
      store: query.optimistic ? this.optimisticData : this.data,
      query: this.transformDocument(query.query),
      variables: query.variables,
      returnPartialData: query.returnPartialData,
      previousResult: query.previousResult,
      config: this.config,
    });
  }

  public watch(watch: Cache.WatchOptions): () => void {
    this.watches.add(watch);

    return () => {
      this.watches.delete(watch);
    };
  }

  public evict(query: Cache.EvictOptions): Cache.EvictionResult {
    throw new InvariantError(`eviction is not implemented on InMemory Cache`);
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

  public addPossibleTypes(possibleTypes: PossibleTypesMap) {
    if (!this.possibleTypes) this.possibleTypes = Object.create(null);
    Object.keys(possibleTypes).forEach(supertype => {
      let subtypeSet = this.possibleTypes[supertype];
      if (!subtypeSet) {
        subtypeSet = this.possibleTypes[supertype] = Object.create(null);
      }
      possibleTypes[supertype].forEach(subtype => {
        subtypeSet[subtype] = true;
      });
    });
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
