import type * as ReactTypes from "react";
import type { DocumentNode, GraphQLFormattedError } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

import type {
  Observable,
  ObservableSubscription,
  OnlyRequiredProperties,
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
  ApolloQueryResult,
  FetchMoreQueryOptions,
  ErrorPolicy,
  RefetchWritePolicy,
} from "../../core/index.js";
import type {
  MutationSharedOptions,
  SharedWatchQueryOptions,
  SubscribeToMoreFunction,
  UpdateQueryMapFn,
} from "../../core/watchQueryOptions.js";
import type { MaybeMasked, Unmasked } from "../../masking/index.js";

/* QueryReference type */

export type {
  QueryReference,
  QueryRef,
  PreloadedQueryRef,
} from "../internal/index.js";

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
  /**
   * {@inheritDoc @apollo/client!QueryOptionsDocumentation#onCompleted:member}
   *
   * @deprecated This option will be removed in the next major version of Apollo Client.
   * For more context, please see the [related issue](https://github.com/apollographql/apollo-client/issues/12352) on GitHub.
   */
  onCompleted?: (data: MaybeMasked<TData>) => void;
  /**
   * {@inheritDoc @apollo/client!QueryOptionsDocumentation#onError:member}
   *
   * @deprecated This option will be removed in the next major version of Apollo Client.
   * For more context, please see the [related issue](https://github.com/apollographql/apollo-client/issues/12352) on GitHub.
   */
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
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#startPolling:member} */
  startPolling: (pollInterval: number) => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#stopPolling:member} */
  stopPolling: () => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#subscribeToMore:member} */
  subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#updateQuery:member} */
  updateQuery: (mapFn: UpdateQueryMapFn<TData, TVariables>) => void;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#refetch:member} */
  refetch: (
    variables?: Partial<TVariables>
  ) => Promise<ApolloQueryResult<MaybeMasked<TData>>>;
  /**
   * @internal
   *
   * @deprecated `reobserve` will be removed in Apollo Client 4.0.
   *
   * **Recommended now**
   *
   * Change options by rerendering the hook with new options.
   */
  reobserve: (
    newOptions?: Partial<WatchQueryOptions<TVariables, TData>>,
    newNetworkStatus?: NetworkStatus
  ) => Promise<ApolloQueryResult<MaybeMasked<TData>>>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#variables:member} */
  variables: TVariables | undefined;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#fetchMore:member} */
  fetchMore: <
    TFetchData = TData,
    TFetchVars extends OperationVariables = TVariables,
  >(
    fetchMoreOptions: FetchMoreQueryOptions<TFetchVars, TFetchData> & {
      updateQuery?: (
        previousQueryResult: Unmasked<TData>,
        options: {
          fetchMoreResult: Unmasked<TFetchData>;
          variables: TFetchVars;
        }
      ) => Unmasked<TData>;
    }
  ) => Promise<ApolloQueryResult<MaybeMasked<TFetchData>>>;
}

export interface QueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends ObservableQueryFields<TData, TVariables> {
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#client:member} */
  client: ApolloClient<any>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#observable:member} */
  observable: ObservableQuery<TData, TVariables>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
  data: MaybeMasked<TData> | undefined;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#previousData:member} */
  previousData?: MaybeMasked<TData>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#error:member} */
  error?: ApolloError;
  /**
   * @deprecated This property will be removed in a future version of Apollo Client.
   * Please use `error.graphQLErrors` instead.
   */
  errors?: ReadonlyArray<GraphQLFormattedError>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#loading:member} */
  loading: boolean;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#networkStatus:member} */
  networkStatus: NetworkStatus;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#called:member} */
  called: boolean;
}

/**
 * @deprecated This type does not exist in Apollo Client 4.0 and is meant as a
 * bridge between versions to add deprecations. Use `QueryResult` instead.
 */
export interface InteropQueryResult<
  TData,
  TVariables extends OperationVariables,
> extends QueryResult<TData, TVariables> {
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#called:member}
   *
   * @deprecated `called` will be removed from the `useQuery` result in Apollo Client 4.0.
   *
   * **Recommended now**
   *
   * Please remove the use of the `called` property.
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
  /**
   * {@inheritDoc @apollo/client!QueryOptionsDocumentation#initialFetchPolicy:member}
   *
   * @deprecated `initialFetchPolicy` will be removed in Apoll Client 4.0.
   *
   * **Recommended now**
   *
   * Please use `fetchPolicy` instead.
   */
  initialFetchPolicy?: WatchQueryFetchPolicy;
  /**
   * {@inheritDoc @apollo/client!QueryOptionsDocumentation#onCompleted:member}
   *
   * @deprecated This option will be removed in Apollo Client 4.0.
   * For more context, please see the [related issue](https://github.com/apollographql/apollo-client/issues/12352) on GitHub.
   */
  onCompleted?: (data: MaybeMasked<TData>) => void;
  /**
   * {@inheritDoc @apollo/client!QueryOptionsDocumentation#onError:member}
   *
   * @deprecated This option will be removed in Apollo Client 4.0.
   * For more context, please see the [related issue](https://github.com/apollographql/apollo-client/issues/12352) on GitHub.
   */
  onError?: (error: ApolloError) => void;

  /**
   * @internal
   *
   * @deprecated `defaultOptions` will be removed in Apollo Client 4.0.
   *
   * **Recommended now**
   *
   * Please pass options directly to `useLazyQuery` instead.
   */
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
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
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

/**
 * @deprecated This type does not exist in Apollo Client 4.0 and is meant as a
 * bridge between versions to add deprecations. Use `QueryResult` instead.
 */
export interface InteropLazyQueryExecResult<
  TData,
  TVariables extends OperationVariables,
> extends QueryResult<TData, TVariables> {
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#client:member}
   *
   * @deprecated `client` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `client` property returned
   * from the hook instead.
   */
  client: ApolloClient<any>;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#observable:member}
   *
   * @deprecated `observable` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `observable` property returned
   * from the hook instead.
   */
  observable: ObservableQuery<TData, TVariables>;
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
  data: MaybeMasked<TData> | undefined;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#previousData:member}
   *
   * @deprecated `previousData` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `previousData` property returned
   * from the hook instead.
   */
  previousData?: MaybeMasked<TData>;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#error:member}
   */
  error?: ApolloError;
  /**
   * @deprecated `errors` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. This value is safe to use in Apollo Client 3.x.
   *
   * **Recommended now**
   *
   * No action needed
   *
   * **When upgrading**
   *
   * `errors` has been consolidated to the `error` property. You will need to
   * read any errors on the `error` property resolved from `execute` instead.
   */
  errors?: ReadonlyArray<GraphQLFormattedError>;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#loading:member}
   *
   * @deprecated `loading` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `loading` property returned
   * from the hook instead.
   */
  loading: boolean;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#networkStatus:member}
   *
   * @deprecated `networkStatus` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `networkStatus` property returned
   * from the hook instead.
   */
  networkStatus: NetworkStatus;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#called:member}
   *
   * @deprecated `called` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `called` property returned
   * from the hook instead.
   */
  called: boolean;

  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#variables:member}
   *
   * @deprecated `variables` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `variables` property returned
   * from the hook instead.
   */
  variables: TVariables | undefined;

  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#startPolling:member}
   *
   * @deprecated `startPolling` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `startPolling` function returned
   * from the hook instead.
   */
  startPolling: (pollInterval: number) => void;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#stopPolling:member}
   *
   * @deprecated `stopPolling` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `stopPolling` function returned
   * from the hook instead.
   */
  stopPolling: () => void;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#subscribeToMore:member}
   *
   * @deprecated `subscribeToMore` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `subscribeToMore` function returned
   * from the hook instead.
   */
  subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#updateQuery:member}
   *
   * @deprecated `updateQuery` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `updateQuery` function returned
   * from the hook instead.
   */
  updateQuery: (mapFn: UpdateQueryMapFn<TData, TVariables>) => void;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#refetch:member}
   *
   * @deprecated `refetch` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `refetch` function returned
   * from the hook instead.
   */
  refetch: (
    variables?: Partial<TVariables>
  ) => Promise<ApolloQueryResult<MaybeMasked<TData>>>;
  /**
   * @internal
   *
   * @deprecated `reobserve` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. To change options, rerender the hook with
   * new options.
   */
  reobserve: (
    newOptions?: Partial<WatchQueryOptions<TVariables, TData>>,
    newNetworkStatus?: NetworkStatus
  ) => Promise<ApolloQueryResult<MaybeMasked<TData>>>;
  /**
   * {@inheritDoc @apollo/client!QueryResultDocumentation#fetchMore:member}
   *
   * @deprecated `fetchMore` is no longer available on the result resolved from
   * `execute` in Apollo Client 4.0. Please use the `fetchMore` function returned
   * from the hook instead.
   */
  fetchMore: <
    TFetchData = TData,
    TFetchVars extends OperationVariables = TVariables,
  >(
    fetchMoreOptions: FetchMoreQueryOptions<TFetchVars, TFetchData> & {
      updateQuery?: (
        previousQueryResult: Unmasked<TData>,
        options: {
          fetchMoreResult: Unmasked<TFetchData>;
          variables: TFetchVars;
        }
      ) => Unmasked<TData>;
    }
  ) => Promise<ApolloQueryResult<MaybeMasked<TFetchData>>>;
}

export type LazyQueryExecFunction<
  TData,
  TVariables extends OperationVariables,
> = (
  options?: Partial<LazyQueryHookExecOptions<TData, TVariables>>
) => Promise<InteropLazyQueryExecResult<TData, TVariables>>;

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
  onCompleted?: (
    data: MaybeMasked<TData>,
    clientOptions?: BaseMutationOptions
  ) => void;
  /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onError:member} */
  onError?: (error: ApolloError, clientOptions?: BaseMutationOptions) => void;
  /**
   * {@inheritDoc @apollo/client!MutationOptionsDocumentation#ignoreResults:member}
   *
   * @deprecated This option will be removed in Apollo Client 4.0. If you don't
   * want to synchronize your component state with the mutation, please use
   * `useApolloClient` to get your ApolloClient instance and call `client.mutate`
   * directly.
   */
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
  /** {@inheritDoc @apollo/client!MutationResultDocumentation#data:member} */
  data?: MaybeMasked<TData> | null;
  /** {@inheritDoc @apollo/client!MutationResultDocumentation#error:member} */
  error?: ApolloError;
  /** {@inheritDoc @apollo/client!MutationResultDocumentation#loading:member} */
  loading: boolean;
  /** {@inheritDoc @apollo/client!MutationResultDocumentation#called:member} */
  called: boolean;
  /** {@inheritDoc @apollo/client!MutationResultDocumentation#client:member} */
  client: ApolloClient<object>;
  /** {@inheritDoc @apollo/client!MutationResultDocumentation#reset:member} */
  reset: () => void;
}

export declare type MutationFunction<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> = (
  options?: MutationFunctionOptions<TData, TVariables, TContext, TCache>
) => Promise<FetchResult<MaybeMasked<TData>>>;

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
  ) => Promise<FetchResult<MaybeMasked<TData>>>,
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
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
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
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#extensions:member} */
  extensions?: Record<string, any>;
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
  /**
   * {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#ignoreResults:member}
   * @defaultValue `false`
   */
  ignoreResults?: boolean;
}

export interface SubscriptionResult<TData = any, TVariables = any> {
  /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#loading:member} */
  loading: boolean;
  /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#data:member} */
  data?: MaybeMasked<TData>;
  /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#error:member} */
  error?: ApolloError;
  // This was added by the legacy useSubscription type, and is tested in unit
  // tests, but probably shouldn’t be added to the result.
  /**
   * @internal
   *
   * @deprecated `variables` will be removed from the returned value in Apollo Client 4.0.
   *
   * **Recommended now**
   *
   * Please remove any use of `variables` returned from `useSubscription`.
   */
  variables?: TVariables;
}

export interface SubscriptionHookOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseSubscriptionOptions<TData, TVariables> {}

/**
 * @deprecated This type is not used anymore. It will be removed in the next major version of Apollo Client
 */
export interface SubscriptionDataOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseSubscriptionOptions<TData, TVariables> {
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>;
  children?:
    | null
    | ((result: SubscriptionResult<TData>) => ReactTypes.ReactNode);
}

export interface SubscriptionCurrentObservable {
  query?: Observable<any>;
  subscription?: ObservableSubscription;
}

export type VariablesOption<TVariables extends OperationVariables> =
  [TVariables] extends [never] ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: Record<string, never>;
    }
  : Record<string, never> extends OnlyRequiredProperties<TVariables> ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: TVariables;
    }
  : {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables: TVariables;
    };

export type { NoInfer } from "../../utilities/index.js";
