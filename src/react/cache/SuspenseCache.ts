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
  observable: ObservableQuery<TData>,
  promise: Promise<ApolloQueryResult<TData>>
}

export class SuspenseCache {
  private cache = new Map<
    DocumentNode,
    Map<string, CacheEntry<any>>
  >();

  get<TData = any>(
    query: DocumentNode | TypedDocumentNode<TData>,
    variables?: OperationVariables
  ): CacheEntry<TData> | undefined {
    return this
      .cache
      .get(query)
      ?.get(canonicalStringify(variables))
  }

  set<TData = any, TVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
    observable: ObservableQuery<TData, TVariables>,
    promise: Promise<ApolloQueryResult<TData>>
  ) {
    const entry: CacheEntry<TData> = {
      resolved: false,
      observable,
      promise: promise.finally(() => {
        entry.resolved = true
      })
    }

    const entries = this.cache.get(query) || new Map();
    entries.set(canonicalStringify(variables), entry);

    this.cache.set(query, entries);

    return this;
  }
}
