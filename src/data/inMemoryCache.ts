import { Cache, CacheWrite } from './cache';

import { DocumentNode } from 'graphql';

import { NormalizedCache } from './storeUtils';

import { ApolloReducerConfig } from '../store';

import { writeResultToStore } from './writeToStore';

import {
  readQueryFromStore,
  diffQueryAgainstStore,
  DiffResult,
} from './readFromStore';

export type OptimisticStoreItem = {
  id: string;
  data: NormalizedCache;
  transaction: (c: Cache) => void;
};

export class InMemoryCache extends Cache {
  private data: NormalizedCache;
  private config: ApolloReducerConfig;
  private nextOptimisticId = 0;
  private optimistic: OptimisticStoreItem[] = [];

  constructor(config: ApolloReducerConfig, initialStore: NormalizedCache = {}) {
    super();
    this.config = config;
    this.data = initialStore;
  }

  public getData(): NormalizedCache {
    return this.data;
  }

  public getOptimisticData(): NormalizedCache {
    if (this.optimistic.length === 0) {
      return this.data;
    }

    const patches = this.optimistic.map(opt => opt.data);
    return Object.assign({}, this.data, ...patches) as NormalizedCache;
  }

  public getOptimisticQueue(): OptimisticStoreItem[] {
    return this.optimistic;
  }

  public reset(): Promise<void> {
    this.data = {};

    return Promise.resolve();
  }

  public applyTransformer(
    transform: (i: NormalizedCache) => NormalizedCache,
  ): void {
    this.data = transform(this.data);
  }

  public diffQuery(query: {
    query: DocumentNode;
    variables: any;
    returnPartialData?: boolean;
    previousResult?: any;
  }): DiffResult {
    return diffQueryAgainstStore({
      store: this.data,
      query: query.query,
      variables: query.variables,
      returnPartialData: query.returnPartialData,
      previousResult: query.previousResult,
      fragmentMatcherFunction: this.config.fragmentMatcher,
      config: this.config,
    });
  }

  public diffQueryOptimistic(query: {
    query: DocumentNode;
    variables: any;
    returnPartialData?: boolean;
    previousResult?: any;
  }): DiffResult {
    return diffQueryAgainstStore({
      store: this.getOptimisticData(),
      query: query.query,
      variables: query.variables,
      returnPartialData: query.returnPartialData,
      previousResult: query.previousResult,
      fragmentMatcherFunction: this.config.fragmentMatcher,
      config: this.config,
    });
  }

  public readQuery(query: {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
    nullIfIdNotFound?: boolean;
  }): any {
    if (
      query.nullIfIdNotFound &&
      query.rootId &&
      typeof this.data[query.rootId] === 'undefined'
    ) {
      return null;
    }

    return readQueryFromStore({
      store: this.data,
      query: query.query,
      variables: query.variables,
      rootId: query.rootId,
      fragmentMatcherFunction: this.config.fragmentMatcher,
      previousResult: query.previousResult,
      config: this.config,
    });
  }

  public readQueryOptimistic(query: {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
    nullIfIdNotFound?: boolean;
  }): any {
    const data = this.getOptimisticData();

    if (
      query.nullIfIdNotFound &&
      query.rootId &&
      typeof data[query.rootId] === 'undefined'
    ) {
      return null;
    }

    return readQueryFromStore({
      store: data,
      query: query.query,
      variables: query.variables,
      rootId: query.rootId,
      fragmentMatcherFunction: this.config.fragmentMatcher,
      previousResult: query.previousResult,
      config: this.config,
    });
  }

  public writeResult(write: CacheWrite): void {
    writeResultToStore({
      ...write,
      store: this.data,
      dataIdFromObject: this.config.dataIdFromObject,
      fragmentMatcherFunction: this.config.fragmentMatcher,
    });
  }

  public removeOptimistic(id: string) {
    // Throw away optimistic changes of that particular mutation
    const toPerform = this.optimistic.filter(item => item.id !== id);

    this.optimistic = [];

    // Re-run all of our optimistic data actions on top of one another.
    toPerform.forEach(change => {
      this.performOptimisticTransaction(change.transaction, change.id);
    });
  }

  public performTransaction(transaction: (c: Cache) => void) {
    // TODO: does this need to be different, or is this okay for an in-memory cache?
    transaction(this);
  }

  public performOptimisticTransaction(
    transaction: (c: Cache) => void,
    id: string,
  ) {
    const before = this.getOptimisticData();

    const orig = this.data;
    this.data = { ...before };
    transaction(this);
    const after = this.data;
    this.data = orig;

    const patch: any = {};

    Object.keys(after).forEach(key => {
      if (after[key] !== before[key]) {
        patch[key] = after[key];
      }
    });

    this.optimistic.push({
      id,
      transaction,
      data: patch,
    });
  }
}
