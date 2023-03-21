import { Trie } from '@wry/trie';
import {
  ApolloClient,
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
} from '../../core';
import { ObservableQuerySubscription } from './ObservableQuerySubscription';

import { canonicalStringify } from '../../cache';
import { canUseWeakMap } from '../../utilities';
type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

export class SuspenseQueryCache {
  private client: ApolloClient<unknown>;

  private cacheKeys = new Trie<CacheKey>(
    canUseWeakMap,
    (cacheKey: CacheKey) => cacheKey
  );

  private subscriptions = new Map<CacheKey, ObservableQuerySubscription>();
  private queriesByObservable = new WeakMap<
    ObservableQuery,
    Promise<ApolloQueryResult<unknown>>
  >();

  constructor(client: ApolloClient<unknown>) {
    this.client = client;
  }

  getSubscription<TData = any>(
    cacheKey: CacheKey,
    createSubscription: (
      client: ApolloClient<unknown>
    ) => ObservableQuerySubscription<TData>
  ) {
    if (!this.subscriptions.has(cacheKey)) {
      this.subscriptions.set(cacheKey, createSubscription(this.client));
    }

    return this.subscriptions.get(
      cacheKey
    )! as ObservableQuerySubscription<TData>;
  }

  getPromise<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    observable: ObservableQuery<TData, TVariables>
  ): Promise<ApolloQueryResult<TData>> | undefined {
    return this.queriesByObservable.get(observable) as Promise<
      ApolloQueryResult<TData>
    >;
  }

  setPromise(
    observable: ObservableQuery,
    promise: Promise<ApolloQueryResult<unknown>>
  ) {
    this.queriesByObservable.set(observable, promise);
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
