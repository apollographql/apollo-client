import { Trie } from '@wry/trie';
import {
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { canonicalStringify } from '../../cache';
import { canUseWeakMap } from '../../utilities';

interface CacheEntry<TData, TVariables extends OperationVariables> {
  observable: ObservableQuery<TData, TVariables>;
  fulfilled: boolean;
  promise: Promise<ApolloQueryResult<TData>>;
}

type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

function makeCacheKey(cacheKey: CacheKey) {
  return cacheKey;
}

export class SuspenseCache {
  private queries = new Map<
    CacheKey,
    CacheEntry<unknown, OperationVariables>
  >();

  private cacheKeys = new Trie<CacheKey>(canUseWeakMap, makeCacheKey);

  add<TData = any, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables | undefined,
    {
      promise,
      observable,
    }: { promise: Promise<any>; observable: ObservableQuery<TData, TVariables> }
  ) {
    const cacheKey = this.getCacheKey(query, variables);

    const entry: CacheEntry<TData, TVariables> = {
      observable,
      fulfilled: false,
      promise: promise
        .catch(() => {
          // Throw away the error as we only care to track when the promise has
          // been fulfilled
        })
        .finally(() => {
          entry.fulfilled = true;
        }),
    };

    this.queries.set(cacheKey, entry);

    return entry;
  }

  lookup<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables | undefined
  ): CacheEntry<TData, TVariables> | undefined {
    const cacheKey = this.getCacheKey(query, variables);

    return this.queries.get(cacheKey) as CacheEntry<TData, TVariables>;
  }

  remove(query: DocumentNode, variables: OperationVariables | undefined) {
    const cacheKey = this.getCacheKey(query, variables);
    const entry = this.queries.get(cacheKey);

    if (entry && !entry.observable.hasObservers()) {
      this.queries.delete(cacheKey);
    }
  }

  private getCacheKey(
    document: DocumentNode,
    variables: OperationVariables | undefined
  ) {
    return this.cacheKeys.lookup(
      document,
      canonicalStringify(variables || EMPTY_VARIABLES)
    );
  }
}
