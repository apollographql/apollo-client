import type {
  Observable,
  Observer,
  OperatorFunction,
  Subscription,
} from "rxjs";

import type {
  DataValue,
  ErrorLike,
  MaybeMasked,
  NetworkStatus,
  OperationVariables,
} from "@apollo/client";

/**
 * This namespace contains simplified interface versions of existing, complicated, types in Apollo Client.
 * These interfaces are used in the documentation to provide a more readable
 * and understandable API reference.
 */
export declare namespace DocumentationTypes {
  export interface DataState<TData> {
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
    data?:
      | DataValue.Complete<TData>
      | DataValue.Streaming<TData>
      | DataValue.Partial<TData>
      | undefined;
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#dataState:member} */
    dataState: "complete" | "streaming" | "partial" | "empty";
  }

  export interface VariableOptions<TVariables extends OperationVariables> {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
    variables?: TVariables;
  }

  export interface ApolloQueryResult<TData> extends DataState<TData> {
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#error:member} */
    error?: ErrorLike;
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#loading:member} */
    loading: boolean;
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#networkStatus:member} */
    networkStatus: NetworkStatus;
    /** {@inheritDoc @apollo/client!QueryResultDocumentation#partial:member} */
    partial: boolean;
  }

  export interface RxjsObservable<TData> {
    pipe<OperatorResult>(
      ...operators:
        | [
            OperatorFunction<
              Observable<ApolloQueryResult<TData>>,
              OperatorResult
            >,
          ]
        | [
            OperatorFunction<Observable<ApolloQueryResult<TData>>, unknown>,
            ...OperatorFunction<unknown, unknown>[],
            OperatorFunction<unknown, OperatorResult>,
          ]
    ): Observable<OperatorResult>;

    subscribe(
      observer:
        | Partial<Observer<ApolloQueryResult<MaybeMasked<TData>>>>
        | ((value: ApolloQueryResult<MaybeMasked<TData>>) => void)
    ): Subscription;
  }
}
