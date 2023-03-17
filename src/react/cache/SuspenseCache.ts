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

type PromiseState<TValue> =
  | { status: 'pending'; value?: never; reason?: never }
  | { status: 'fulfilled'; value: TValue; reason?: never }
  | { status: 'rejected'; value?: never; reason: unknown };

type PromiseWithState<TValue> = Promise<TValue> & PromiseState<TValue>;

interface CacheEntry<TData, TVariables extends OperationVariables> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  variables: TVariables | undefined;
  observable: ObservableQuery<TData, TVariables>;
  promise: PromiseWithState<ApolloQueryResult<TData>>;
}

type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

function makeCacheKey(cacheKey: CacheKey) {
  return cacheKey;
}

function isStatefulPromise<TValue>(
  promise: Promise<TValue>
): promise is PromiseWithState<TValue> {
  return 'status' in promise;
}

function addStateToPromise<TValue>(
  promise: Promise<TValue>
): PromiseWithState<TValue> {
  if (isStatefulPromise(promise)) {
    return promise;
  }

  const statefulPromise = promise as PromiseWithState<TValue>;

  statefulPromise.status = 'pending';
  statefulPromise.value = void 0;
  statefulPromise.reason = void 0;

  statefulPromise
    .then((value) => {
      statefulPromise.status = 'fulfilled';
      statefulPromise.value = value;
    })
    .catch((reason) => {
      statefulPromise.status = 'rejected';
      statefulPromise.reason = reason;
    });

  return statefulPromise;
}

export class SuspenseCache {
  private queries = new Map<
    CacheKey,
    CacheEntry<unknown, OperationVariables>
  >();

  private queriesByPromise = canUseWeakMap
    ? new WeakMap<
        PromiseWithState<ApolloQueryResult<unknown>>,
        OperationVariables
      >()
    : new Map<
        PromiseWithState<ApolloQueryResult<unknown>>,
        OperationVariables
      >();

  private cacheKeys = new Trie<CacheKey>(canUseWeakMap, makeCacheKey);

  add<TData = any, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables | undefined,
    {
      promise,
      observable,
    }: {
      promise: Promise<ApolloQueryResult<TData>>;
      observable: ObservableQuery<TData, TVariables>;
    }
  ) {
    const cacheKey = this.getCacheKey(query, variables);

    const entry: CacheEntry<TData, TVariables> = {
      query,
      variables,
      observable,
      promise: addStateToPromise(promise),
    };

    this.queries.set(cacheKey, entry);
    this.queriesByPromise.set(entry.promise, entry);

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

  reverseLookup(promise: PromiseWithState<ApolloQueryResult<unknown>>) {
    return this.queriesByPromise.get(promise);
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
