import { Trie } from '@wry/trie';
import {
  ApolloClient,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { QuerySubscription } from './QuerySubscription';

import { canonicalStringify } from '../../cache';
import { canUseWeakMap } from '../../utilities';

export type CacheKey = [DocumentNode, string];

export class SuspenseQueryCache {
  private client: ApolloClient<unknown>;

  private cacheKeys = new Trie<CacheKey>(
    canUseWeakMap,
    (cacheKey: CacheKey) => cacheKey
  );

  private subscriptions = new Map<CacheKey, QuerySubscription>();

  constructor(client: ApolloClient<unknown>) {
    this.client = client;
  }

  getSubscription<TData = any>(
    query: DocumentNode | TypedDocumentNode<TData>,
    variables: OperationVariables | undefined,
    createObservable: (client: ApolloClient<unknown>) => ObservableQuery<TData>
  ) {
    const cacheKey = this.cacheKeys.lookup(
      query,
      canonicalStringify(variables)
    );

    if (!this.subscriptions.has(cacheKey)) {
      this.subscriptions.set(
        cacheKey,
        new QuerySubscription(createObservable(this.client), {
          onDispose: () => this.subscriptions.delete(cacheKey),
        })
      );
    }

    return this.subscriptions.get(cacheKey)! as QuerySubscription<TData>;
  }
}
