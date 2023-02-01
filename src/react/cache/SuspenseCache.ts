import {
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { canonicalStringify } from '../../cache';

interface CacheEntry<TData, TVariables extends OperationVariables> {
  observable: ObservableQuery<TData, TVariables>;
  fulfilled: boolean;
  promise: Promise<ApolloQueryResult<TData>>;
}

export class SuspenseCache {
  private queries = new Map<
    DocumentNode,
    Map<string, CacheEntry<unknown, any>>
  >();

  add<TData = any, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables | undefined,
    {
      promise,
      observable,
    }: { promise: Promise<any>; observable: ObservableQuery<TData, TVariables> }
  ) {
    const variablesKey = this.getVariablesKey(variables);
    const map = this.queries.get(query) || new Map();

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

    map.set(variablesKey, entry);

    this.queries.set(query, map);

    return entry;
  }

  lookup<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables | undefined
  ): CacheEntry<TData, TVariables> | undefined {
    return this.queries
      .get(query)
      ?.get(this.getVariablesKey(variables)) as CacheEntry<TData, TVariables>;
  }

  remove(query: DocumentNode, variables: OperationVariables | undefined) {
    const map = this.queries.get(query);

    if (!map) {
      return;
    }

    const key = this.getVariablesKey(variables);
    const entry = map.get(key);

    if (entry && !entry.observable.hasObservers()) {
      map.delete(key);
    }

    if (map.size === 0) {
      this.queries.delete(query);
    }
  }

  private getVariablesKey(variables: OperationVariables | undefined) {
    return canonicalStringify(variables || Object.create(null));
  }
}
