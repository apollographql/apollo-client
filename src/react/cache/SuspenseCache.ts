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
  promise: DecoratedPromise<ApolloQueryResult<TData>>;
}

type PromiseState<TValue> =
  | { status: 'pending'; value?: never; reason?: never }
  | { status: 'fulfilled'; value: TValue; reason?: never }
  | { status: 'rejected'; value?: never; reason: unknown };

type DecoratedPromise<TValue> = Promise<TValue> & PromiseState<TValue>;

type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

function makeCacheKey(cacheKey: CacheKey) {
  return cacheKey;
}

function isDecoratedPromise<TValue>(
  promise: Promise<TValue>
): promise is DecoratedPromise<TValue> {
  return 'status' in promise;
}

function decoratePromise<TValue>(
  promise: Promise<TValue>
): DecoratedPromise<TValue> {
  if (isDecoratedPromise(promise)) {
    return promise;
  }

  const decoratedPromise = promise as DecoratedPromise<TValue>;

  decoratedPromise.status = 'pending';
  decoratedPromise.value = void 0;
  decoratedPromise.reason = void 0;

  decoratedPromise
    .then((value) => {
      decoratedPromise.status = 'fulfilled';
      decoratedPromise.value = value;
    })
    .catch((reason) => {
      decoratedPromise.status = 'rejected';
      decoratedPromise.reason = reason;
    });

  return decoratedPromise;
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
      promise: decoratePromise(promise),
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
