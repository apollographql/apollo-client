import { Trie } from '@wry/trie';
import {
  ApolloClient,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
  ApolloQueryResult,
} from '../../core';
import { canonicalStringify } from '../../cache';
import { canUseWeakMap } from '../../utilities';
import { QuerySubscription } from './QuerySubscription';

type CacheKey = [ApolloClient<unknown>, DocumentNode, string];

export class SuspenseCache {
  private cacheKeys = new Trie<CacheKey>(
    canUseWeakMap,
    (cacheKey: CacheKey) => cacheKey
  );

  private subscriptions = new Map<CacheKey, QuerySubscription>();

  getSubscription<TData = any>(
    client: ApolloClient<unknown>,
    query: DocumentNode | TypedDocumentNode<TData>,
    variables: OperationVariables | undefined,
    createObservable: () => ObservableQuery<TData>
  ) {
    const cacheKey = this.cacheKeys.lookup(
      client,
      query,
      canonicalStringify(variables)
    );

    if (!this.subscriptions.has(cacheKey)) {
      this.subscriptions.set(
        cacheKey,
        new QuerySubscription(createObservable(), {
          onDispose: () => this.subscriptions.delete(cacheKey),
        })
      );
    }

    return this.subscriptions.get(cacheKey)! as QuerySubscription<TData>;
  }

  getSubscriptionFromPromise<TData>(
    promise: Promise<ApolloQueryResult<TData>>
  ) {
    return Array.from(this.subscriptions.values()).find(
      (subscription) => subscription.promise === promise
    );
  }
}
