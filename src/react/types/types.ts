import type * as ReactTypes from "react";
import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

import type {
  Observable,
  ObservableSubscription,
} from "../../utilities/index.js";
import type { FetchResult } from "../../link/core/index.js";
import type { ApolloError } from "../../errors/index.js";
import type {
  ApolloCache,
  ApolloClient,
  DefaultContext,
  FetchPolicy,
  NetworkStatus,
  ObservableQuery,
  OperationVariables,
  InternalRefetchQueriesInclude,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
  SubscribeToMoreOptions,
  ApolloQueryResult,
  FetchMoreQueryOptions,
  ErrorPolicy,
  RefetchWritePolicy,
} from "../../core/index.js";
import type {
  MutationSharedOptions,
  SharedWatchQueryOptions,
} from "../../core/watchQueryOptions.js";

/* QueryReference type */

export type { QueryReference } from "../internal/index.js";

/* Common types */

export type { DefaultContext as Context } from "../../core/index.js";

export type CommonOptions<TOptions> = TOptions & {
  client?: ApolloClient<object>;
};

/* Query types */

export interface BaseQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
  TData = any,
> extends SharedWatchQueryOptions<TVariables, TData> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#ssr:member} */
  ssr?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
  client?: ApolloClient<any>;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
}

export interface QueryFunctionOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseQueryOptions<TVariables, TData> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#skip:member} */
  skip?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#onCompleted:member} */
  onCompleted?: (data: TData) => void;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#onError:member} */
  onError?: (error: ApolloError) => void;

  // Default WatchQueryOptions for this useQuery, providing initial values for
  // unspecified options, superseding client.defaultOptions.watchQuery (option
  // by option, not whole), but never overriding options previously passed to
  // useQuery (or options added/modified later by other means).
  // TODO What about about default values that are expensive to evaluate?
  /** @internal */
  defaultOptions?: Partial<WatchQueryOptions<TVariables, TData>>;
}

export interface ObservableQueryFields<
  TData,
  TVariables extends OperationVariables,
> {
  /** {@inheritDoc @apollo/client!ObservableQuery#startPolling:member(1)} */
  startPolling(pollInterval: number): void;
  /** {@inheritDoc @apollo/client!ObservableQuery#stopPolling:member(1)} */
  stopPolling(): void;
  /** {@inheritDoc @apollo/client!ObservableQuery#subscribeToMore:member(1)} */
  subscribeToMore<
    TSubscriptionData = TData,
    TSubscriptionVariables extends OperationVariables = TVariables,
  >(
    options: SubscribeToMoreOptions<
      TData,
      TSubscriptionVariables,
      TSubscriptionData
    >
  ): () => void;
  /** {@inheritDoc @apollo/client!ObservableQuery#updateQuery:member(1)} */
  updateQuery<TVars extends OperationVariables = TVariables>(
    mapFn: (
      previousQueryResult: TData,
      options: Pick<WatchQueryOptions<TVars, TData>, "variables">
    ) => TData
  ): void;
  /**
   * A function that enables you to re-execute the query, optionally passing in new `variables`.
   *
   * To guarantee that the refetch performs a network request, its `fetchPolicy` is set to `network-only` (unless the original query's `fetchPolicy` is `no-cache` or `cache-and-network`, which also guarantee a network request).
   *
   * See also [Refetching](/react/data/queries/#refetching).
   */
  refetch(variables?: Partial<TVariables>): Promise<ApolloQueryResult<TData>>;
  /** {@inheritDoc @apollo/client!ObservableQuery#reobserve:member(1)} */
  reobserve(
    newOptions?: Partial<WatchQueryOptions<TVariables, TData>>,
    newNetworkStatus?: NetworkStatus
  ): Promise<ApolloQueryResult<TData>>;
  /** {@inheritDoc @apollo/client!ObservableQuery#variables:member} */
  variables: TVariables | undefined;
  /** {@inheritDoc @apollo/client!ObservableQuery#fetchMore:member(1)} */
  fetchMore<
    TFetchData = TData,
    TFetchVars extends OperationVariables = TVariables,
  >(
    fetchMoreOptions: FetchMoreQueryOptions<TFetchVars, TFetchData> & {
      updateQuery?: (
        previousQueryResult: TData,
        options: {
          fetchMoreResult: TFetchData;
          variables: TFetchVars;
        }
      ) => TData;
    }
  ): Promise<ApolloQueryResult<TFetchData>>;
}

export interface QueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends ObservableQueryFields<TData, TVariables> {
  /**
   * The instance of Apollo Client that executed the query.
   * Can be useful for manually executing followup queries or writing data to the cache.
   */
  client: ApolloClient<any>;
  /**
   * A reference to the internal `ObservableQuery` used by the hook.
   */
  observable: ObservableQuery<TData, TVariables>;
  /**
   * An object containing the result of your GraphQL query after it completes.
   *
   * This value might be `undefined` if a query results in one or more errors (depending on the query's `errorPolicy`).
   */
  data: TData | undefined;
  /**
   * An object containing the result from the most recent _previous_ execution of this query.
   *
   * This value is `undefined` if this is the query's first execution.
   */
  previousData?: TData;
  /**
   * If the query produces one or more errors, this object contains either an array of `graphQLErrors` or a single `networkError`. Otherwise, this value is `undefined`.
   *
   * For more information, see [Handling operation errors](/react/data/error-handling/).
   */
  error?: ApolloError;
  /**
   * If `true`, the query is still in flight and results have not yet been returned.
   */
  loading: boolean;
  /**
   * A number indicating the current network state of the query's associated request. [See possible values.](https://github.com/apollographql/apollo-client/blob/d96f4578f89b933c281bb775a39503f6cdb59ee8/src/core/networkStatus.ts#L4)
   *
   * Used in conjunction with the [`notifyOnNetworkStatusChange`](#notifyonnetworkstatuschange) option.
   */
  networkStatus: NetworkStatus;
  /**
   * If `true`, the associated lazy query has been executed.
   *
   * This field is only present on the result object returned by [`useLazyQuery`](/react/data/queries/#executing-queries-manually).
   */
  called: boolean;
}

export interface QueryDataOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends QueryFunctionOptions<TData, TVariables> {
  children?: (result: QueryResult<TData, TVariables>) => ReactTypes.ReactNode;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#query:member} */
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface QueryHookOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends QueryFunctionOptions<TData, TVariables> {}

export interface LazyQueryHookOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseQueryOptions<TVariables, TData> {
  /** {@inheritDoc @apollo/client!QueryFunctionOptions#onCompleted:member} */
  onCompleted?: (data: TData) => void;
  /** {@inheritDoc @apollo/client!QueryFunctionOptions#onError:member} */
  onError?: (error: ApolloError) => void;

  /** @internal */
  defaultOptions?: Partial<WatchQueryOptions<TVariables, TData>>;
}
export interface LazyQueryHookExecOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends LazyQueryHookOptions<TData, TVariables> {
  query?: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export type SuspenseQueryHookFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export interface SuspenseQueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!BaseQueryOptions#client:member} */
  client?: ApolloClient<any>;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: TVariables;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#canonizeResults:member} */
  canonizeResults?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
  returnPartialData?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy_suspense:member} */
  refetchWritePolicy?: RefetchWritePolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: SuspenseQueryHookFetchPolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#queryKey:member} */
  queryKey?: string | number | any[];

  /**
   * {@inheritDoc @apollo/client!QueryOptionsDocumentation#skip_deprecated:member}
   *
   * @example Recommended usage of `skipToken`:
   * ```ts
   * import { skipToken, useSuspenseQuery } from '@apollo/client';
   *
   * const { data } = useSuspenseQuery(query, id ? { variables: { id } } : skipToken);
   * ```
   * */
  skip?: boolean;
}

export type BackgroundQueryHookFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export interface BackgroundQueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> extends Pick<
    QueryHookOptions<TData, TVariables>,
    | "client"
    | "variables"
    | "errorPolicy"
    | "context"
    | "canonizeResults"
    | "returnPartialData"
    | "refetchWritePolicy"
  > {
  fetchPolicy?: BackgroundQueryHookFetchPolicy;
  queryKey?: string | number | any[];

  /**
   * {@inheritDoc @apollo/client!QueryOptionsDocumentation#skip_deprecated:member}
   *
   * @example Recommended usage of `skipToken`:
   * ```ts
   * import { skipToken, useBackgroundQuery } from '@apollo/client';
   *
   * const [queryRef] = useBackgroundQuery(query, id ? { variables: { id } } : skipToken);
   * ```
   */
  skip?: boolean;
}

export type LoadableQueryHookFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export interface LoadableQueryHookOptions {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#canonizeResults:member} */
  canonizeResults?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
  client?: ApolloClient<any>;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: LoadableQueryHookFetchPolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#queryKey:member} */
  queryKey?: string | number | any[];
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
  refetchWritePolicy?: RefetchWritePolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
  returnPartialData?: boolean;
}

/**
 * @deprecated This type will be removed in the next major version of Apollo Client
 */
export interface QueryLazyOptions<TVariables> {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
  variables?: TVariables;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
}

/**
 * @deprecated This type will be removed in the next major version of Apollo Client
 */
export type LazyQueryResult<
  TData,
  TVariables extends OperationVariables,
> = QueryResult<TData, TVariables>;

/**
 * @deprecated This type will be removed in the next major version of Apollo Client
 */
export type QueryTuple<
  TData,
  TVariables extends OperationVariables,
> = LazyQueryResultTuple<TData, TVariables>;

export type LazyQueryExecFunction<
  TData,
  TVariables extends OperationVariables,
> = (
  options?: Partial<LazyQueryHookExecOptions<TData, TVariables>>
) => Promise<QueryResult<TData, TVariables>>;

export type LazyQueryResultTuple<
  TData,
  TVariables extends OperationVariables,
> = [
  execute: LazyQueryExecFunction<TData, TVariables>,
  result: QueryResult<TData, TVariables>,
];

/* Mutation types */

export type RefetchQueriesFunction = (
  ...args: any[]
) => InternalRefetchQueriesInclude;

export interface BaseMutationOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends MutationSharedOptions<TData, TVariables, TContext, TCache> {
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#client:member} */
  client?: ApolloClient<object>;
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#notifyOnNetworkStatusChange:member} */
  notifyOnNetworkStatusChange?: boolean;
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onCompleted:member} */
  onCompleted?: (data: TData, clientOptions?: BaseMutationOptions) => void;
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onError:member} */
  onError?: (error: ApolloError, clientOptions?: BaseMutationOptions) => void;
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#ignoreResults:member} */
  ignoreResults?: boolean;
}

export interface MutationFunctionOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends BaseMutationOptions<TData, TVariables, TContext, TCache> {
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#mutation:member} */
  mutation?: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface MutationResult<TData = any> {
  /**
   * The data returned from your mutation. Can be `undefined` if `ignoreResults` is `true`.
   */
  data?: TData | null;
  /**
   * If the mutation produces one or more errors, this object contains either an array of `graphQLErrors` or a single `networkError`. Otherwise, this value is `undefined`.
   *
   * For more information, see [Handling operation errors](/react/data/error-handling/).
   */
  error?: ApolloError;
  /**
   * If `true`, the mutation is currently in flight.
   */
  loading: boolean;
  /**
   * If `true`, the mutation's mutate function has been called.
   */
  called: boolean;
  /**
   * The instance of Apollo Client that executed the mutation.
   *
   * Can be useful for manually executing followup operations or writing data to the cache.
   */
  client: ApolloClient<object>;
  /**
   * A function that you can call to reset the mutation's result to its initial, uncalled state.
   */
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
> extends BaseMutationOptions<TData, TVariables, TContext, TCache> {}

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
  mutate: (
    options?: MutationFunctionOptions<TData, TVariables, TContext, TCache>
    // TODO This FetchResult<TData> seems strange here, as opposed to an
    // ApolloQueryResult<TData>
  ) => Promise<FetchResult<TData>>,
  result: MutationResult<TData>,
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
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#variables:member} */
  variables?: TVariables;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: FetchPolicy;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#shouldResubscribe:member} */
  shouldResubscribe?:
    | boolean
    | ((options: BaseSubscriptionOptions<TData, TVariables>) => boolean);
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#client:member} */
  client?: ApolloClient<object>;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#skip:member} */
  skip?: boolean;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onComplete:member} */
  onComplete?: () => void;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onData:member} */
  onData?: (options: OnDataOptions<TData>) => any;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onSubscriptionData:member} */
  onSubscriptionData?: (options: OnSubscriptionDataOptions<TData>) => any;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onError:member} */
  onError?: (error: ApolloError) => void;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onSubscriptionComplete:member} */
  onSubscriptionComplete?: () => void;
}

export interface SubscriptionResult<TData = any, TVariables = any> {
  /**
   * A boolean that indicates whether any initial data has been returned
   */
  loading: boolean;
  /**
   * An object containing the result of your GraphQL subscription. Defaults to an empty object.
   */
  data?: TData;
  /**
   * A runtime error with `graphQLErrors` and `networkError` properties
   */
  error?: ApolloError;
  // This was added by the legacy useSubscription type, and is tested in unit
  // tests, but probably shouldn’t be added to the result.
  variables?: TVariables;
}

export interface SubscriptionHookOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseSubscriptionOptions<TData, TVariables> {}

export interface SubscriptionDataOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseSubscriptionOptions<TData, TVariables> {
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>;
  children?: null | ((result: SubscriptionResult<TData>) => JSX.Element | null);
}

export interface SubscriptionCurrentObservable {
  query?: Observable<any>;
  subscription?: ObservableSubscription;
}

/**
Helper type that allows using a type in a way that cannot be "widened" by inference on the value it is used on.

This type was first suggested [in this Github discussion](https://github.com/microsoft/TypeScript/issues/14829#issuecomment-504042546).

Example usage:
```ts
export function useQuery<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: QueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> = Object.create(null),
)
```
In this case, `TData` and `TVariables` should be inferred from `query`, but never widened from something in `options`.

So, in this code example:
```ts
declare const typedNode: TypedDocumentNode<{ foo: string}, { bar: number }>
const { variables } = useQuery(typedNode, { variables: { bar: 4, nonExistingVariable: "string" } });
```
Without the use of `NoInfer`, `variables` would now be of the type `{ bar: number, nonExistingVariable: "string" }`.
With `NoInfer`, it will instead give an error on `nonExistingVariable`.
 */
export type NoInfer<T> = [T][T extends any ? 0 : never];
