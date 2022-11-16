import { ReactNode } from 'react';
import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';

import { Observable, ObservableSubscription } from '../../utilities';
import { FetchResult } from '../../link/core';
import { ApolloError } from '../../errors';
import {
  ApolloCache,
  ApolloClient,
  DefaultContext,
  FetchPolicy,
  MutationOptions,
  NetworkStatus,
  ObservableQuery,
  OperationVariables,
  InternalRefetchQueriesInclude,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
} from '../../core';
import { NextFetchPolicyContext } from '../../core/watchQueryOptions';

/* Common types */

export type { DefaultContext as Context } from "../../core";

export type CommonOptions<TOptions> = TOptions & {
  client?: ApolloClient<object>;
};

/* Query types */

export interface BaseQueryOptions<TVariables = OperationVariables>
extends Omit<WatchQueryOptions<TVariables>, "query"> {
  ssr?: boolean;
  client?: ApolloClient<any>;
  context?: DefaultContext;
}

export interface QueryFunctionOptions<
  TData = any,
  TVariables = OperationVariables
> extends BaseQueryOptions<TVariables> {
  skip?: boolean;
  onCompleted?: (data: TData) => void;
  onError?: (error: ApolloError) => void;

  // Default WatchQueryOptions for this useQuery, providing initial values for
  // unspecified options, superseding client.defaultOptions.watchQuery (option
  // by option, not whole), but never overriding options previously passed to
  // useQuery (or options added/modified later by other means).
  // TODO What about about default values that are expensive to evaluate?
  defaultOptions?: Partial<WatchQueryOptions<TVariables, TData>>;
}

export type ObservableQueryFields<TData, TVariables> = Pick<
  ObservableQuery<TData, TVariables>,
  | 'startPolling'
  | 'stopPolling'
  | 'subscribeToMore'
  | 'updateQuery'
  | 'refetch'
  | 'reobserve'
  | 'variables'
  | 'fetchMore'
>;

export interface QueryResult<TData = any, TVariables = OperationVariables>
  extends ObservableQueryFields<TData, TVariables> {
  client: ApolloClient<any>;
  observable: ObservableQuery<TData, TVariables>;
  data: TData | undefined;
  previousData?: TData;
  error?: ApolloError;
  loading: boolean;
  networkStatus: NetworkStatus;
  called: boolean;
}

export interface QueryDataOptions<TData = any, TVariables = OperationVariables>
  extends QueryFunctionOptions<TData, TVariables> {
  children?: (result: QueryResult<TData, TVariables>) => ReactNode;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface QueryHookOptions<TData = any, TVariables = OperationVariables>
  extends QueryFunctionOptions<TData, TVariables> {
  query?: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface LazyQueryHookOptions<
  TData = any,
  TVariables = OperationVariables
> extends Omit<QueryHookOptions<TData, TVariables>, 'skip'> {}

/**
 * suspensePolicy determines how suspense behaves for a refetch. The options are:
 * - always (default): Re-suspend a component when a refetch occurs
 * - initial: Only suspend on the first fetch
 */
export type SuspensePolicy =
  | 'always'
  | 'initial'

export type SuspenseQueryHookFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  | 'cache-first'
  | 'network-only'
  | 'no-cache'
  | 'cache-and-network'
>;

export interface SuspenseQueryHookOptions<
  TData = any,
  TVariables = OperationVariables
> extends Pick<
  QueryHookOptions<TData, TVariables>,
  | 'client'
  | 'variables'
  | 'errorPolicy'
  | 'context'
  | 'canonizeResults'
  | 'returnPartialData'
  | 'refetchWritePolicy'
> {
  fetchPolicy?: SuspenseQueryHookFetchPolicy;
  nextFetchPolicy?:
    | SuspenseQueryHookFetchPolicy
    | ((
        currentFetchPolicy: SuspenseQueryHookFetchPolicy,
        context: NextFetchPolicyContext<TData, TVariables>
      ) => SuspenseQueryHookFetchPolicy);
  suspensePolicy?: SuspensePolicy;
}

/**
 * @deprecated TODO Delete this unused interface.
 */
export interface QueryLazyOptions<TVariables> {
  variables?: TVariables;
  context?: DefaultContext;
}

/**
 * @deprecated TODO Delete this unused type alias.
 */
export type LazyQueryResult<TData, TVariables> = QueryResult<TData, TVariables>;

/**
 * @deprecated TODO Delete this unused type alias.
 */
export type QueryTuple<TData, TVariables> =
  LazyQueryResultTuple<TData, TVariables>;

export type LazyQueryExecFunction<TData, TVariables> = (
  options?: Partial<LazyQueryHookOptions<TData, TVariables>>,
) => Promise<QueryResult<TData, TVariables>>;

export type LazyQueryResultTuple<TData, TVariables> = [
  LazyQueryExecFunction<TData, TVariables>,
  QueryResult<TData, TVariables>,
];

/* Mutation types */

export type RefetchQueriesFunction = (
  ...args: any[]
) => InternalRefetchQueriesInclude;

export interface BaseMutationOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>
> extends Omit<
  MutationOptions<TData, TVariables, TContext, TCache>,
  | "mutation"
> {
  client?: ApolloClient<object>;
  notifyOnNetworkStatusChange?: boolean;
  onCompleted?: (data: TData, clientOptions?: BaseMutationOptions) => void;
  onError?: (error: ApolloError, clientOptions?: BaseMutationOptions) => void;
  ignoreResults?: boolean;
}

export interface MutationFunctionOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends BaseMutationOptions<TData, TVariables, TContext, TCache> {
  mutation?: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface MutationResult<TData = any> {
  data?: TData | null;
  error?: ApolloError;
  loading: boolean;
  called: boolean;
  client: ApolloClient<object>;
  reset(): void;
}

export declare type MutationFunction<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> = (
  options?: MutationFunctionOptions<TData, TVariables, TContext, TCache>
) => Promise<FetchResult<TData>>;

export interface MutationHookOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends BaseMutationOptions<TData, TVariables, TContext, TCache> {
  mutation?: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface MutationDataOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends BaseMutationOptions<TData, TVariables, TContext, TCache> {
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export type MutationTuple<
  TData,
  TVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> = [
  (
    options?: MutationFunctionOptions<TData, TVariables, TContext, TCache>
    // TODO This FetchResult<TData> seems strange here, as opposed to an
    // ApolloQueryResult<TData>
  ) => Promise<FetchResult<TData>>,
  MutationResult<TData>,
];

/* Subscription types */

export interface OnDataOptions<TData = any> {
  client: ApolloClient<object>;
  data: SubscriptionResult<TData>;
}

export interface OnSubscriptionDataOptions<TData = any> {
  client: ApolloClient<object>;
  subscriptionData: SubscriptionResult<TData>;
}

export interface BaseSubscriptionOptions<
  TData = any,
  TVariables = OperationVariables
> {
  variables?: TVariables;
  fetchPolicy?: FetchPolicy;
  shouldResubscribe?:
    | boolean
    | ((options: BaseSubscriptionOptions<TData, TVariables>) => boolean);
  client?: ApolloClient<object>;
  skip?: boolean;
  context?: DefaultContext;
  onComplete?: () => void;
  onData?: (options: OnDataOptions<TData>) => any;
  /**
  * @deprecated Use onData instead
  */
  onSubscriptionData?: (options: OnSubscriptionDataOptions<TData>) => any;
  onError?: (error: ApolloError) => void;
  /**
  * @deprecated Use onComplete instead
  */
  onSubscriptionComplete?: () => void;
}

export interface SubscriptionResult<TData = any, TVariables = any> {
  loading: boolean;
  data?: TData;
  error?: ApolloError;
  // This was added by the legacy useSubscription type, and is tested in unit
  // tests, but probably shouldn’t be added to the result.
  variables?: TVariables;
}

export interface SubscriptionHookOptions<
  TData = any,
  TVariables = OperationVariables
> extends BaseSubscriptionOptions<TData, TVariables> {
  subscription?: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface SubscriptionDataOptions<
  TData = any,
  TVariables = OperationVariables
> extends BaseSubscriptionOptions<TData, TVariables> {
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>;
  children?: null | ((result: SubscriptionResult<TData>) => JSX.Element | null);
}

export interface SubscriptionCurrentObservable {
  query?: Observable<any>;
  subscription?: ObservableSubscription;
}
