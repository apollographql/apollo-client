import { Trie } from '@wry/trie';
import {
  ApolloClient,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
} from '../../core';
import { ObservableQuerySubscription } from './ObservableQuerySubscription';

import { canonicalStringify } from '../../cache';
import { canUseWeakMap } from '../../utilities';

export type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

export class SuspenseQueryCache {
  private client: ApolloClient<unknown>;

  private cacheKeys = new Trie<CacheKey>(
    canUseWeakMap,
    (cacheKey: CacheKey) => cacheKey
  );

  private subscriptions = new Map<CacheKey, ObservableQuerySubscription>();

  constructor(client: ApolloClient<unknown>) {
    this.client = client;
  }

  getSubscription<TData = any>(
    cacheKey: CacheKey,
    createObservable: (client: ApolloClient<unknown>) => ObservableQuery<TData>
  ) {
    if (!this.subscriptions.has(cacheKey)) {
      this.subscriptions.set(
        cacheKey,
        new ObservableQuerySubscription(createObservable(this.client), {
          onDispose: () => this.subscriptions.delete(cacheKey),
        })
      );
    }

    return this.subscriptions.get(
      cacheKey
    )! as ObservableQuerySubscription<TData>;
  }

  getCacheKey(
    document: DocumentNode,
    variables: OperationVariables | undefined
  ) {
    return this.cacheKeys.lookup(
      document,
      canonicalStringify(variables || EMPTY_VARIABLES)
    );
  }
}
