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

  private suspendedQueries = new Map<
    ObservableQuery,
    Promise<ApolloQueryResult<any>>
  >();

  getObservable<TData = any>(
    query: DocumentNode | TypedDocumentNode<TData>,
    variables?: OperationVariables
  ): ObservableQuery | undefined {
    return this
      .inFlightObservables
      .get(query)
      ?.get(canonicalStringify(variables));
  }

  getPromise<TData = any>(observable: ObservableQuery<TData>) {
    return this.suspendedQueries.get(observable);
  }

  setObservable<TData = any, TVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
    observable: ObservableQuery<TData, TVariables>
  ) {
    const byVariables = this.inFlightObservables.get(query) || new Map();
    byVariables.set(canonicalStringify(variables), observable);

    return this;
  }

  setPromise(observableQuery: ObservableQuery, promise: Promise<any>) {
    this.suspendedQueries.set(observableQuery, promise);

    return this;
  }

  removePromise(observable: ObservableQuery) {
    this.suspendedQueries.delete(observable);
  }
}
