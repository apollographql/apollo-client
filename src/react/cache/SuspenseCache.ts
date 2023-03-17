import { Trie } from '@wry/trie';
import {
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
} from '../../core';
import { canonicalStringify } from '../../cache';
import { PromiseWithState, canUseWeakMap } from '../../utilities';

interface CacheEntry {
  query: DocumentNode;
  variables: OperationVariables | undefined;
  observable: ObservableQuery<unknown, OperationVariables>;
  promise: PromiseWithState<ApolloQueryResult<unknown>>;
}

type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

function makeCacheKey(cacheKey: CacheKey) {
  return cacheKey;
}

export class SuspenseCache {
  private queries = new Map<CacheKey, CacheEntry>();

  private cacheKeys = new Trie<CacheKey>(canUseWeakMap, makeCacheKey);

  add({
    query,
    variables,
    promise,
    observable,
  }: {
    query: DocumentNode;
    variables: OperationVariables | undefined;
    promise: PromiseWithState<ApolloQueryResult<unknown>>;
    observable: ObservableQuery<unknown, OperationVariables>;
  }) {
    const cacheKey = this.getCacheKey(query, variables);

    const entry: CacheEntry = {
      query,
      variables,
      observable,
      promise,
    };

    this.queries.set(cacheKey, entry);

    return entry;
  }

  lookup(query: DocumentNode, variables: OperationVariables | undefined) {
    const cacheKey = this.getCacheKey(query, variables);

    return this.queries.get(cacheKey);
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
