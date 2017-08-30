import { DocumentNode } from 'graphql';

import {
  Cache,
  CacheWrite,
  DataProxyReadFragmentOptions,
  DataProxyReadQueryOptions,
  DataProxyWriteQueryOptions,
  DataProxyWriteFragmentOptions,
  QueryWatch,
  DiffResult,
} from 'apollo-cache-core';

import {
  getFragmentQueryDocument,
  addTypenameToDocument,
} from 'apollo-utilities';

import { HeuristicFragmentMatcher } from './fragmentMatcher';
import {
  OptimisticStoreItem,
  ApolloReducerConfig,
  NormalizedCache,
} from './types';
import { writeResultToStore } from './writeToStore';
import { readQueryFromStore, diffQueryAgainstStore } from './readFromStore';

const defaultConfig: ApolloReducerConfig = {
  fragmentMatcher: new HeuristicFragmentMatcher().match,
  dataIdFromObject: defaultDataIdFromObject,
  addTypename: true,
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

export class InMemoryCache extends Cache {
  private data: NormalizedCache;
  private config: ApolloReducerConfig;
  private optimistic: OptimisticStoreItem[] = [];
  private watches: QueryWatch[] = [];
  private addTypename: boolean;

  constructor(
    initialStore: NormalizedCache = {},
    config: ApolloReducerConfig = {},
  ) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.addTypename = this.config.addTypename ? true : false;
    this.data = initialStore;
  }

  public transformDocument(document: DocumentNode): DocumentNode {
    if (this.addTypename) return addTypenameToDocument(document);
    return document;
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

  public reset(): Promise<void> {
    this.data = {};
    this.broadcastWatches();

    return Promise.resolve();
  }

  public diffQuery<T>(query: {
    query: DocumentNode;
    variables: any;
    returnPartialData?: boolean;
    previousResult?: any;
    optimistic: boolean;
  }): DiffResult<T> {
    return diffQueryAgainstStore({
      store: query.optimistic ? this.getOptimisticData() : this.data,
      query: this.transformDocument(query.query),
      variables: query.variables,
      returnPartialData: query.returnPartialData,
      previousResult: query.previousResult,
      fragmentMatcherFunction: this.config.fragmentMatcher,
      config: this.config,
    });
  }

  public read(query: {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
  }): any {
    if (query.rootId && typeof this.data[query.rootId] === 'undefined') {
      return null;
    }

    return readQueryFromStore({
      store: query.optimistic ? this.getOptimisticData() : this.data,
      query: this.transformDocument(query.query),
      variables: query.variables,
      rootId: query.rootId,
      fragmentMatcherFunction: this.config.fragmentMatcher,
      previousResult: query.previousResult,
      config: this.config,
    });
  }

  public readQuery<QueryType>(
    options: DataProxyReadQueryOptions,
    optimistic: boolean = false,
  ): QueryType {
    let query = options.query;
    return this.read({
      query,
      variables: options.variables,
      optimistic,
    });
  }

  public readFragment<FragmentType>(
    options: DataProxyReadFragmentOptions,
    optimistic: boolean = false,
  ): FragmentType | null {
    let document = getFragmentQueryDocument(
      options.fragment,
      options.fragmentName,
    );

    return this.read({
      query: this.transformDocument(document),
      variables: options.variables,
      rootId: options.id,
      optimistic,
    });
  }

  public writeResult(write: CacheWrite): void {
    writeResultToStore({
      ...write,
      store: this.data,
      dataIdFromObject: this.config.dataIdFromObject,
      fragmentMatcherFunction: this.config.fragmentMatcher,
    });

    this.broadcastWatches();
  }

  public writeQuery(options: DataProxyWriteQueryOptions): void {
    let query = options.query;
    this.writeResult({
      dataId: 'ROOT_QUERY',
      result: options.data,
      document: this.transformDocument(query),
      variables: options.variables,
    });
  }

  public writeFragment(options: DataProxyWriteFragmentOptions): void {
    let document = getFragmentQueryDocument(
      options.fragment,
      options.fragmentName,
    );

    this.writeResult({
      dataId: options.id,
      result: options.data,
      document: this.transformDocument(document),
      variables: options.variables,
    });
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

  public performTransaction(transaction: (c: Cache) => void) {
    // TODO: does this need to be different, or is this okay for an in-memory cache?
    transaction(this);
  }

  public recordOptimisticTransaction(
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

    this.broadcastWatches();
  }

  public watch(watch: QueryWatch): () => void {
    this.watches.push(watch);

    return () => {
      this.watches = this.watches.filter(c => c !== watch);
    };
  }

  private broadcastWatches() {
    // right now, we invalidate all queries whenever anything changes
    this.watches.forEach(c => {
      const newData = this.diffQuery({
        query: c.query,
        variables: c.variables,
        previousResult: c.previousResult(),
        optimistic: c.optimistic,
      });

      c.callback(newData);
    });
  }
}
