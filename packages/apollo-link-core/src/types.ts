import Observable, { ZenObservable } from 'zen-observable-ts';
import { ExecutionResult, DocumentNode } from 'graphql';

export type SubscriptionObserver<T> = ZenObservable.SubscriptionObserver<T>;
export type Subscription = ZenObservable.Subscription;
export type Observer<T> = ZenObservable.Observer<T>;
export type Subscriber<T> = ZenObservable.Subscriber<T>;
export type ObservableLike<T> = ZenObservable.ObservableLike<T>;

export interface GraphQLRequest {
  query?: string | DocumentNode;
  variables?: Record<string, any>;
  context?: Record<string, any>;
}

export interface Operation {
  query: DocumentNode;
  variables?: Record<string, any>;
  operationName?: string | null;
  context?: Record<string, any>;
}

export type FetchResult<
  C = Record<string, any>,
  E = Record<string, any>
> = ExecutionResult & {
  extensions?: E;
  context?: C;
};

export type NextLink = (operation: Operation) => Observable<FetchResult>;
export type RequestHandler = (
  operation: Operation,
  forward?: NextLink,
) => Observable<FetchResult> | null;
