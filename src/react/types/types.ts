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
  MutationOptions,
  NetworkStatus,
  ObservableQuery,
  OperationVariables,
  InternalRefetchQueriesInclude,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
  ErrorPolicy,
  RefetchWritePolicy,
} from "../../core/index.js";

/* QueryReference type */

export type { QueryReference } from "../cache/QueryReference.js";

/* Common types */

export type { DefaultContext as Context } from "../../core/index.js";

export type CommonOptions<TOptions> = TOptions & {
  client?: ApolloClient<object>;
};

/* Query types */

export interface BaseQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
> extends Omit<WatchQueryOptions<TVariables>, "query"> {
  ssr?: boolean;
  client?: ApolloClient<any>;
  context?: DefaultContext;
}

export interface QueryFunctionOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
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

export type ObservableQueryFields<
  TData,
  TVariables extends OperationVariables,
> = Pick<
  ObservableQuery<TData, TVariables>,
  | "startPolling"
  | "stopPolling"
  | "subscribeToMore"
  | "updateQuery"
  | "refetch"
  | "reobserve"
  | "variables"
  | "fetchMore"
>;

export interface QueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends ObservableQueryFields<TData, TVariables> {
  client: ApolloClient<any>;
  observable: ObservableQuery<TData, TVariables>;
  data: TData | undefined;
  previousData?: TData;
  error?: ApolloError;
  loading: boolean;
  networkStatus: NetworkStatus;
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
> extends Omit<QueryHookOptions<TData, TVariables>, "skip"> {}

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
  fetchPolicy?: SuspenseQueryHookFetchPolicy;
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

export type InteractiveQueryHookFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export interface InteractiveQueryHookOptions {
  /**
   * Whether to canonize cache results before returning them. Canonization
   * takes some extra time, but it speeds up future deep equality comparisons.
   * Defaults to false.
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
  fetchPolicy?: InteractiveQueryHookFetchPolicy;
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
 * @deprecated TODO Delete this unused interface.
 */
export interface QueryLazyOptions<TVariables> {
  variables?: TVariables;
  context?: DefaultContext;
}

/**
 * @deprecated TODO Delete this unused type alias.
 */
export type LazyQueryResult<
  TData,
  TVariables extends OperationVariables,
> = QueryResult<TData, TVariables>;

/**
 * @deprecated TODO Delete this unused type alias.
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
> = [LazyQueryExecFunction<TData, TVariables>, QueryResult<TData, TVariables>];

/* Mutation types */

export type RefetchQueriesFunction = (
  ...args: any[]
) => InternalRefetchQueriesInclude;

export interface BaseMutationOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends Omit<
    MutationOptions<TData, TVariables, TContext, TCache>,
    "mutation"
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
  TVariables extends OperationVariables = OperationVariables,
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
