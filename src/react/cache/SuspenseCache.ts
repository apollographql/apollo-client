import {
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { canonicalStringify } from '../../cache';

interface CacheEntry<TData = unknown> {
  resolved: boolean;
  promise: Promise<ApolloQueryResult<TData>>;
}

export class SuspenseCache {
  private queries = new Map<DocumentNode, ObservableQuery>();
  private cache = new Map<ObservableQuery, Map<string, CacheEntry<any>>>();

  registerQuery<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    query: DocumentNode | TypedDocumentNode<TData>,
    observable: ObservableQuery<TData, TVariables>
  ) {
    this.queries.set(query, observable);

    return observable;
  }

  getQuery<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    query: DocumentNode | TypedDocumentNode<TData>
  ): ObservableQuery<TData, TVariables> | undefined {
    return this.queries.get(query) as ObservableQuery<TData, TVariables>;
  }

  deregisterQuery(query: DocumentNode | TypedDocumentNode) {
    const observable = this.queries.get(query);

    if (!observable || observable.hasObservers()) {
      return;
    }

    this.queries.delete(query);
    this.cache.delete(observable);
  }

  getVariables<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    observable: ObservableQuery<TData, TVariables>,
    variables: TVariables | undefined
  ): CacheEntry<TData> | undefined {
    return this.cache.get(observable)?.get(canonicalStringify(variables));
  }

  setVariables<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    observable: ObservableQuery,
    variables: TVariables | undefined,
    promise: Promise<ApolloQueryResult<TData>>
  ) {
    const entry: CacheEntry<TData> = {
      resolved: false,
      promise: promise.finally(() => {
        entry.resolved = true;
      }),
    };

    const entries = this.cache.get(observable) || new Map();
    entries.set(canonicalStringify(variables), entry);

    this.cache.set(observable, entries);

    return entry;
  }
}
