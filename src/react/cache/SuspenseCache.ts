import { Trie } from '@wry/trie';
import {
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { canonicalStringify } from '../../cache';
import { PromiseWithState, canUseWeakMap } from '../../utilities';

interface CacheEntry<TData, TVariables extends OperationVariables> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  variables: TVariables | undefined;
  observable: ObservableQuery<TData, TVariables>;
  promise: PromiseWithState<ApolloQueryResult<TData>>;
}

type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

export class SuspenseCache {
  private queries = new Map<
    CacheKey,
    CacheEntry<unknown, OperationVariables>
  >();

  private cacheKeys = new Trie<CacheKey>(
    canUseWeakMap,
    (cacheKey: CacheKey) => cacheKey
  );

  add<TData = any, TVariables extends OperationVariables = OperationVariables>({
    query,
    variables,
    promise,
    observable,
  }: {
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;
    variables: TVariables | undefined;
    promise: PromiseWithState<ApolloQueryResult<TData>>;
    observable: ObservableQuery<TData, TVariables>;
  }) {
    const cacheKey = this.getCacheKey(query, variables);

    const entry: CacheEntry<TData, TVariables> = {
      query,
      variables,
      observable,
      promise,
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
