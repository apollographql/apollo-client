import {
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { canonicalStringify } from '../../cache';

export class SuspenseCache {
  private inFlightObservables = new Map<
    DocumentNode,
    Map<string, ObservableQuery<ApolloQueryResult<any>>>
  >();

  get<TData = any>(
    query: DocumentNode | TypedDocumentNode<TData>,
    variables?: OperationVariables
  ): ObservableQuery | undefined {
    return this
      .inFlightObservables
      .get(query)
      ?.get(canonicalStringify(variables));
  }

  set<TData = any, TVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
    observable: ObservableQuery<TData, TVariables>
  ) {
    const byVariables = this.inFlightObservables.get(query) || new Map();
    byVariables.set(canonicalStringify(variables), observable);
    this.inFlightObservables.set(query, byVariables);

    return this;
  }

  remove(query: DocumentNode | TypedDocumentNode, variables?: OperationVariables) {
    const byVariables = this.inFlightObservables.get(query);

    if (!byVariables) {
      return
    }

    byVariables.delete(canonicalStringify(variables));

    if (byVariables.size === 0) {
      this.inFlightObservables.delete(query)
    }
  }
}
