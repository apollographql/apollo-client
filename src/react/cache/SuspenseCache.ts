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
  promise: Promise<ApolloQueryResult<TData>>
}

export class SuspenseCache {
  private queries = new Map<DocumentNode, ObservableQuery>();
  private cache = new Map<
    ObservableQuery,
    Map<string, CacheEntry<any>>
  >();

  registerQuery<TData = any>(
    query: DocumentNode | TypedDocumentNode<TData>,
    observable: ObservableQuery<TData>
  ) {
    this.queries.set(query, observable);

    return observable;
  }

  getQuery<TData = any>(
    query: DocumentNode | TypedDocumentNode<TData>
  ): ObservableQuery<TData> | undefined {
    return this.queries.get(query);
  }

  getVariables<TData = any, TVariables = OperationVariables>(
    observable: ObservableQuery<TData, TVariables>,
    variables?: TVariables,
  ): CacheEntry<TData> | undefined {
    return this
      .cache
      .get(observable)
      ?.get(canonicalStringify(variables))
  }

  setVariables<TData = any, TVariables = OperationVariables>(
    observable: ObservableQuery,
    variables: TVariables,
    promise: Promise<ApolloQueryResult<TData>>
  ) {
    const entry: CacheEntry<TData> = {
      resolved: false,
      promise: promise.finally(() => {
        entry.resolved = true;
      }),
    }

    const entries = this.cache.get(observable) || new Map();
    entries.set(canonicalStringify(variables), entry);

    this.cache.set(observable, entries);

    return this;
  }
}
