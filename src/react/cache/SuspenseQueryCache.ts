import { Trie } from '@wry/trie';
import {
  ApolloClient,
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  WatchQueryOptions,
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

  private observables = new Map<CacheKey, ObservableQuery>();
  private subscriptions = new Map<
    ObservableQuery,
    ObservableQuerySubscription
  >();
  private queriesByObservable = new WeakMap<
    ObservableQuery,
    Promise<ApolloQueryResult<unknown>>
  >();

  constructor(client: ApolloClient<unknown>) {
    this.client = client;
  }

  getObservable<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    watchQueryOptions: WatchQueryOptions<TVariables, TData>
  ): ObservableQuery<TData, TVariables> {
    const { query, variables } = watchQueryOptions;

    const cacheKey = this.getCacheKey(query, variables);

    if (!this.observables.has(cacheKey)) {
      this.observables.set(cacheKey, this.client.watchQuery(watchQueryOptions));
    }

    return this.observables.get(cacheKey)! as ObservableQuery<
      TData,
      TVariables
    >;
  }

  getSubscription<TData = any>(observable: ObservableQuery<TData>) {
    if (!this.subscriptions.has(observable)) {
      this.subscriptions.set(
        observable,
        new ObservableQuerySubscription(observable)
      );
    }

    return this.subscriptions.get(
      observable
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
