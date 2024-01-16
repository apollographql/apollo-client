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
  ssr?: boolean;
  /**
   * The instance of `ApolloClient` to use to execute the query.
   *
   * By default, the instance that's passed down via context is used, but you can provide a different instance here.
   */
  client?: ApolloClient<any>;
  context?: DefaultContext;
}

export interface QueryFunctionOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseQueryOptions<TVariables, TData> {
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

  /** {@inheritDoc @apollo/client!QueryFunctionOptions#defaultOptions:member} */
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
  /** {@inheritDoc @apollo/client!QueryOptions#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!QueryOptions#variables:member} */
  variables?: TVariables;
  /** {@inheritDoc @apollo/client!QueryOptions#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
  /** {@inheritDoc @apollo/client!QueryOptions#canonizeResults:member} */
  canonizeResults?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptions#returnPartialData:member} */
  returnPartialData?: boolean;
  /** {@inheritDoc @apollo/client!~SharedWatchQueryOptions#refetchWritePolicy:member} */
  refetchWritePolicy?: RefetchWritePolicy;
  /**
   * Watched queries must opt into overwriting existing data on refetch, by passing `refetchWritePolicy: "overwrite"` in their `WatchQueryOptions`.
   *
   * The default value is `"overwrite"`.
   */
  fetchPolicy?: SuspenseQueryHookFetchPolicy;
  /**
   * A unique identifier for the query. Each item in the array must be a stable identifier to prevent infinite fetches.
   *
   * This is useful when using the same query and variables combination in more than one component, otherwise the components may clobber each other. This can also be used to force the query to re-evaluate fresh.
   */
  queryKey?: string | number | any[];

  /**
   * If `true`, the query is not executed. The default value is `false`.
   *
   * @deprecated We recommend using `skipToken` in place of the `skip` option as
   * it is more type-safe.
   *
   * @example Recommended usage of `skipToken`:
   * ```ts
   * import { skipToken, useSuspenseQuery } from '@apollo/client';
   *
   * const { data } = useSuspenseQuery(query, id ? { variables: { id } } : skipToken);
   * ```
   */
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
   * If `true`, the query is not executed. The default value is `false`.
   *
   * @deprecated We recommend using `skipToken` in place of the `skip` option as
   * it is more type-safe.
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
  /**
   * Whether to canonize cache results before returning them. Canonization
   * takes some extra time, but it speeds up future deep equality comparisons.
   * Defaults to false.
   *
   * @deprecated
   * Using `canonizeResults` can result in memory leaks so we generally do not
   * recommend using this option anymore.
   * A future version of Apollo Client will contain a similar feature without
   * the risk of memory leaks.
   */
  canonizeResults?: boolean;
  /**
   * The instance of {@link ApolloClient} to use to execute the query.
   *
   * By default, the instance that's passed down via context is used, but you
   * can provide a different instance here.
   */
  client?: ApolloClient<any>;
  /**
   * Context to be passed to link execution chain
   */
  context?: DefaultContext;
  /**
   * Specifies the {@link ErrorPolicy} to be used for this query
   */
  errorPolicy?: ErrorPolicy;
  /**
   *
   * Specifies how the query interacts with the Apollo Client cache during
   * execution (for example, whether it checks the cache for results before
   * sending a request to the server).
   *
   * For details, see {@link https://www.apollographql.com/docs/react/data/queries/#setting-a-fetch-policy | Setting a fetch policy}.
   *
   * The default value is `cache-first`.
   */
  fetchPolicy?: LoadableQueryHookFetchPolicy;
  /**
   * A unique identifier for the query. Each item in the array must be a stable
   * identifier to prevent infinite fetches.
   *
   * This is useful when using the same query and variables combination in more
   * than one component, otherwise the components may clobber each other. This
   * can also be used to force the query to re-evaluate fresh.
   */
  queryKey?: string | number | any[];
  /**
   * Specifies whether a {@link NetworkStatus.refetch} operation should merge
   * incoming field data with existing data, or overwrite the existing data.
   * Overwriting is probably preferable, but merging is currently the default
   * behavior, for backwards compatibility with Apollo Client 3.x.
   */
  refetchWritePolicy?: RefetchWritePolicy;
  /**
   * Allow returning incomplete data from the cache when a larger query cannot
   * be fully satisfied by the cache, instead of returning nothing.
   */
  returnPartialData?: boolean;
}

/**
 * @deprecated This type will be removed in the next major version of Apollo Client
 */
export interface QueryLazyOptions<TVariables> {
  variables?: TVariables;
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
  /**
   * The instance of `ApolloClient` to use to execute the mutation.
   *
   * By default, the instance that's passed down via context is used, but you can provide a different instance here.
   */
  client?: ApolloClient<object>;
  /**
   * If `true`, the in-progress mutation's associated component re-renders whenever the network status changes or a network error occurs.
   *
   * The default value is `false`.
   */
  notifyOnNetworkStatusChange?: boolean;
  /**
   * A callback function that's called when your mutation successfully completes with zero errors (or if `errorPolicy` is `ignore` and partial data is returned).
   *
   * This function is passed the mutation's result `data` and any options passed to the mutation.
   */
  onCompleted?: (data: TData, clientOptions?: BaseMutationOptions) => void;
  /**
   * A callback function that's called when the mutation encounters one or more errors (unless `errorPolicy` is `ignore`).
   *
   * This function is passed an [`ApolloError`](https://github.com/apollographql/apollo-client/blob/d96f4578f89b933c281bb775a39503f6cdb59ee8/src/errors/index.ts#L36-L39) object that contains either a `networkError` object or a `graphQLErrors` array, depending on the error(s) that occurred, as well as any options passed the mutation.
   */
  onError?: (error: ApolloError, clientOptions?: BaseMutationOptions) => void;
  /**
   * If `true`, the mutation's `data` property is not updated with the mutation's result.
   *
   * The default value is `false`.
   */
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
  /**
   * An object containing all of the variables your subscription needs to execute
   */
  variables?: TVariables;
  /**
   * How you want your component to interact with the Apollo cache. For details, see [Setting a fetch policy](/react/data/queries/#setting-a-fetch-policy).
   */
  fetchPolicy?: FetchPolicy;
  /**
   * Determines if your subscription should be unsubscribed and subscribed again when an input to the hook (such as `subscription` or `variables`) changes.
   */
  shouldResubscribe?:
    | boolean
    | ((options: BaseSubscriptionOptions<TData, TVariables>) => boolean);
  /**
   * An `ApolloClient` instance. By default `useSubscription` / `Subscription` uses the client passed down via context, but a different client can be passed in.
   */
  client?: ApolloClient<object>;

  /**
   * Determines if the current subscription should be skipped. Useful if, for example, variables depend on previous queries and are not ready yet.
   */
  skip?: boolean;
  /**
   * Shared context between your component and your network interface (Apollo Link).
   */
  context?: DefaultContext;
  /**
   * Allows the registration of a callback function that will be triggered each time the `useSubscription` Hook / `Subscription` component completes the subscription.
   */
  onComplete?: () => void;
  /**
   * Allows the registration of a callback function that will be triggered each time the `useSubscription` Hook / `Subscription` component receives data. The callback `options` object param consists of the current Apollo Client instance in `client`, and the received subscription data in `data`.
   */
  onData?: (options: OnDataOptions<TData>) => any;
  /**
   * Allows the registration of a callback function that will be triggered each time the `useSubscription` Hook / `Subscription` component receives data. The callback `options` object param consists of the current Apollo Client instance in `client`, and the received subscription data in `subscriptionData`.
   *
   * @deprecated Use onData instead
   */
  onSubscriptionData?: (options: OnSubscriptionDataOptions<TData>) => any;
  /**
   * Allows the registration of a callback function that will be triggered each time the `useSubscription` Hook / `Subscription` component receives an error.
   */
  onError?: (error: ApolloError) => void;
  /**
   * Allows the registration of a callback function that will be triggered when the `useSubscription` Hook / `Subscription` component completes the subscription.
   *
   * @deprecated Use onComplete instead
   */
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
