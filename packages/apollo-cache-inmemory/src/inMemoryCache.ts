import { DocumentNode } from 'graphql';

import { Cache, DataProxy, ApolloCache, Transaction } from 'apollo-cache';

import {
  getFragmentQueryDocument,
  addTypenameToDocument,
} from 'apollo-utilities';

import { HeuristicFragmentMatcher } from './fragmentMatcher';
import {
  OptimisticStoreItem,
  ApolloReducerConfig,
  NormalizedCache,
  NormalizedCacheObject,
} from './types';
import { writeResultToStore } from './writeToStore';
import { readQueryFromStore, diffQueryAgainstStore } from './readFromStore';
import { defaultNormalizedCacheFactory } from './objectCache';
import { record } from './recordingCache';
const defaultConfig: ApolloReducerConfig = {
  fragmentMatcher: new HeuristicFragmentMatcher(),
  dataIdFromObject: defaultDataIdFromObject,
  addTypename: true,
  storeFactory: defaultNormalizedCacheFactory,
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
  protected data: NormalizedCache;
  protected config: ApolloReducerConfig;
  protected optimistic: OptimisticStoreItem[] = [];
  private watches: Cache.WatchOptions[] = [];
  private addTypename: boolean;

  // Set this while in a transaction to prevent broadcasts...
  // don't forget to turn it back on!
  private silenceBroadcast: boolean = false;

  constructor(config: ApolloReducerConfig = {}) {
    super();
    this.config = { ...defaultConfig, ...config };

    // backwards compat
    if ((this.config as any).customResolvers) {
      console.warn(
        'customResolvers have been renamed to cacheRedirects. Please update your config as we will be deprecating customResolvers in the next major version.',
      );
      this.config.cacheRedirects = (this.config as any).customResolvers;
    }

    if ((this.config as any).cacheResolvers) {
      console.warn(
        'cacheResolvers have been renamed to cacheRedirects. Please update your config as we will be deprecating cacheResolvers in the next major version.',
      );
      this.config.cacheRedirects = (this.config as any).cacheResolvers;
    }

    this.addTypename = this.config.addTypename;
    this.data = this.config.storeFactory();
  }

  public restore(data: NormalizedCacheObject): this {
    if (data) this.data.replace(data);
    return this;
  }

  public extract(optimistic: boolean = false): NormalizedCacheObject {
    if (optimistic && this.optimistic.length > 0) {
      const patches = this.optimistic.map(opt => opt.data);
      return Object.assign({}, this.data.toObject(), ...patches);
    }

    return this.data.toObject();
  }

  public read<T>(query: Cache.ReadOptions): T | null {
    if (query.rootId && this.data.get(query.rootId) === undefined) {
      return null;
    }

    return readQueryFromStore({
      store: this.config.storeFactory(this.extract(query.optimistic)),
      query: this.transformDocument(query.query),
      variables: query.variables,
      rootId: query.rootId,
      fragmentMatcherFunction: this.config.fragmentMatcher.match,
      previousResult: query.previousResult,
      config: this.config,
    });
  }

  public write(write: Cache.WriteOptions): void {
    writeResultToStore({
      dataId: write.dataId,
      result: write.result,
      variables: write.variables,
      document: this.transformDocument(write.query),
      store: this.data,
      dataIdFromObject: this.config.dataIdFromObject,
      fragmentMatcherFunction: this.config.fragmentMatcher.match,
    });

    this.broadcastWatches();
  }

  public diff<T>(query: Cache.DiffOptions): Cache.DiffResult<T> {
    return diffQueryAgainstStore({
      store: this.config.storeFactory(this.extract(query.optimistic)),
      query: this.transformDocument(query.query),
      variables: query.variables,
      returnPartialData: query.returnPartialData,
      previousResult: query.previousResult,
      fragmentMatcherFunction: this.config.fragmentMatcher.match,
      config: this.config,
    });
  }

  public watch(watch: Cache.WatchOptions): () => void {
    this.watches.push(watch);

    return () => {
      this.watches = this.watches.filter(c => c !== watch);
    };
  }

  public evict(query: Cache.EvictOptions): Cache.EvictionResult {
    throw new Error(`eviction is not implemented on InMemory Cache`);
  }

  public reset(): Promise<void> {
    this.data.clear();
    this.broadcastWatches();

    return Promise.resolve();
  }

  public removeOptimistic(id: string) {
    // Throw away optimistic changes of that particular mutation
    const toPerform = this.optimistic.filter(item => item.id !== id);

    this.optimistic = [];

    // Re-run all of our optimistic data actions on top of one another.
    toPerform.forEach(change => {
      this.recordOptimisticTransaction(change.transaction, change.id);
    });

    this.broadcastWatches();
  }

  public performTransaction(transaction: Transaction<NormalizedCacheObject>) {
    // TODO: does this need to be different, or is this okay for an in-memory cache?

    let alreadySilenced = this.silenceBroadcast;
    this.silenceBroadcast = true;

    transaction(this);

    if (!alreadySilenced) {
      // Don't un-silence since this is a nested transaction
      // (for example, a transaction inside an optimistic record)
      this.silenceBroadcast = false;
    }

    this.broadcastWatches();
  }

  public recordOptimisticTransaction(
    transaction: Transaction<NormalizedCacheObject>,
    id: string,
  ) {
    this.silenceBroadcast = true;

    const patch = record(this.extract(true), recordingCache => {
      // swapping data instance on 'this' is currently necessary
      // because of the current architecture
      const dataCache = this.data;
      this.data = recordingCache;
      this.performTransaction(transaction);
      this.data = dataCache;
    });

    this.optimistic.push({
      id,
      transaction,
      data: patch,
    });

    this.silenceBroadcast = false;

    this.broadcastWatches();
  }

  public transformDocument(document: DocumentNode): DocumentNode {
    if (this.addTypename) return addTypenameToDocument(document);
    return document;
  }

  public readQuery<QueryType>(
    options: DataProxy.Query,
    optimistic: boolean = false,
  ): QueryType {
    return this.read({
      query: options.query,
      variables: options.variables,
      optimistic,
    });
  }

  public readFragment<FragmentType>(
    options: DataProxy.Fragment,
    optimistic: boolean = false,
  ): FragmentType | null {
    return this.read({
      query: this.transformDocument(
        getFragmentQueryDocument(options.fragment, options.fragmentName),
      ),
      variables: options.variables,
      rootId: options.id,
      optimistic,
    });
  }

  public writeQuery(options: DataProxy.WriteQueryOptions): void {
    this.write({
      dataId: 'ROOT_QUERY',
      result: options.data,
      query: this.transformDocument(options.query),
      variables: options.variables,
    });
  }

  public writeFragment(options: DataProxy.WriteFragmentOptions): void {
    this.write({
      dataId: options.id,
      result: options.data,
      query: this.transformDocument(
        getFragmentQueryDocument(options.fragment, options.fragmentName),
      ),
      variables: options.variables,
    });
  }

  protected broadcastWatches() {
    // Skip this when silenced (like inside a transaction)
    if (this.silenceBroadcast) return;

    // right now, we invalidate all queries whenever anything changes
    this.watches.forEach((c: Cache.WatchOptions) => {
      const newData = this.diff({
        query: c.query,
        variables: c.variables,

        // TODO: previousResult isn't in the types - this will only work
        // with ObservableQuery which is in a different package
        previousResult: (c as any).previousResult && c.previousResult(),
        optimistic: c.optimistic,
      });

      c.callback(newData);
    });
  }
}
