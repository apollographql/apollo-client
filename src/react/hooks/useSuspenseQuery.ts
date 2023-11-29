import * as React from "rehackt";
import { invariant } from "../../utilities/globals/index.js";
import type {
  ApolloClient,
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
  FetchMoreQueryOptions,
  WatchQueryOptions,
} from "../../core/index.js";
import { ApolloError, NetworkStatus } from "../../core/index.js";
import type { DeepPartial } from "../../utilities/index.js";
import { isNonEmptyArray } from "../../utilities/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { DocumentType, verifyDocumentType } from "../parser/index.js";
import type {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
  NoInfer,
} from "../types/types.js";
import { __use, useDeepMemo } from "./internal/index.js";
import { getSuspenseCache } from "../cache/index.js";
import { canonicalStringify } from "../../cache/index.js";
import { skipToken } from "./constants.js";
import type { SkipToken } from "./constants.js";
import type { CacheKey } from "../cache/types.js";

export interface UseSuspenseQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  /**
   * The instance of Apollo Client that executed the query.
   *
   * Can be useful for manually executing followup queries or writing data to
   * the cache.
   */
  client: ApolloClient<any>;
  /**
   * An object containing the result of your GraphQL query after it completes.
   *
   * This value might be `undefined` if a query results in one or more errors
   * (depending on the query's `errorPolicy`).
   */
  data: TData;
  /**
   * If the query produces one or more errors, this object contains either an
   * array of `graphQLErrors` or a single `networkError`. Otherwise, this value
   * is `undefined`.
   *
   * This property can be ignored when using the default `errorPolicy` or an
   * `errorPolicy` of `none`. The hook will throw the error instead of setting
   * this property.
   */
  error: ApolloError | undefined;
  /** {@inheritDoc @apollo/client!ObservableQuery#fetchMore:member(1)} */
  fetchMore: FetchMoreFunction<TData, TVariables>;
  /**
   * A number indicating the current network state of the query's associated
   * request. [See possible values](https://github.com/apollographql/apollo-client/blob/d96f4578f89b933c281bb775a39503f6cdb59ee8/src/core/networkStatus.ts#L4).
   */
  networkStatus: NetworkStatus;
  /** {@inheritDoc @apollo/client!ObservableQuery#refetch:member(1)} */
  refetch: RefetchFunction<TData, TVariables>;
  /**
   * A function that enables you to execute a [subscription](https://www.apollographql.com/docs/react/data/subscriptions/),
   * usually to subscribe to specific fields that were included in the query.
   *
   * This function returns another function that you can call to terminate the
   * subscription.
   */
  subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
}

export type FetchMoreFunction<TData, TVariables extends OperationVariables> = (
  fetchMoreOptions: FetchMoreQueryOptions<TVariables, TData> & {
    updateQuery?: (
      previousQueryResult: TData,
      options: {
        fetchMoreResult: TData;
        variables: TVariables;
      }
    ) => TData;
  }
) => Promise<ApolloQueryResult<TData>>;

export type RefetchFunction<
  TData,
  TVariables extends OperationVariables,
> = ObservableQueryFields<TData, TVariables>["refetch"];

export type SubscribeToMoreFunction<
  TData,
  TVariables extends OperationVariables,
> = ObservableQueryFields<TData, TVariables>["subscribeToMore"];

export function useSuspenseQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends Omit<SuspenseQueryHookOptions<TData>, "variables">,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> &
    TOptions
): UseSuspenseQueryResult<
  TOptions["errorPolicy"] extends "ignore" | "all"
    ? TOptions["returnPartialData"] extends true
      ? DeepPartial<TData> | undefined
      : TData | undefined
    : TOptions["returnPartialData"] extends true
    ? TOptions["skip"] extends boolean
      ? DeepPartial<TData> | undefined
      : DeepPartial<TData>
    : TOptions["skip"] extends boolean
    ? TData | undefined
    : TData,
  TVariables
>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
    errorPolicy: "ignore" | "all";
  }
): UseSuspenseQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    errorPolicy: "ignore" | "all";
  }
): UseSuspenseQueryResult<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    skip: boolean;
    returnPartialData: true;
  }
): UseSuspenseQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
  }
): UseSuspenseQueryResult<DeepPartial<TData>, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    skip: boolean;
  }
): UseSuspenseQueryResult<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
): UseSuspenseQueryResult<TData, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
        returnPartialData: true;
      })
): UseSuspenseQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?:
    | SkipToken
    | SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
): UseSuspenseQueryResult<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | (SkipToken & Partial<SuspenseQueryHookOptions<TData, TVariables>>)
    | SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData | undefined, TVariables> {
  const client = useApolloClient(options.client);
  const suspenseCache = getSuspenseCache(client);
  const watchQueryOptions = useWatchQueryOptions<any, any>({
    client,
    query,
    options,
  });
  const { fetchPolicy, variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  const cacheKey: CacheKey = [
    query,
    canonicalStringify(variables),
    ...([] as any[]).concat(queryKey),
  ];

  const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  const [promiseCache, setPromiseCache] = React.useState(
    () => new Map([[queryRef.key, queryRef.promise]])
  );

  let promise = promiseCache.get(queryRef.key);

  if (queryRef.didChangeOptions(watchQueryOptions)) {
    promise = queryRef.applyOptions(watchQueryOptions);
    promiseCache.set(queryRef.key, promise);
  }

  if (!promise) {
    promise = queryRef.promise;
    promiseCache.set(queryRef.key, promise);
  }

  React.useEffect(() => {
    const dispose = queryRef.retain();

    const removeListener = queryRef.listen((promise) => {
      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, promise)
      );
    });

    return () => {
      removeListener();
      dispose();
    };
  }, [queryRef]);

  const skipResult = React.useMemo(() => {
    const error = toApolloError(queryRef.result);

    return {
      loading: false,
      data: queryRef.result.data,
      networkStatus: error ? NetworkStatus.error : NetworkStatus.ready,
      error,
    };
  }, [queryRef.result]);

  const result = fetchPolicy === "standby" ? skipResult : __use(promise);

  const fetchMore = React.useCallback(
    ((options) => {
      const promise = queryRef.fetchMore(options);

      setPromiseCache((previousPromiseCache) =>
        new Map(previousPromiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    }) satisfies FetchMoreFunction<
      unknown,
      OperationVariables
    > as FetchMoreFunction<TData | undefined, TVariables>,
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (variables) => {
      const promise = queryRef.refetch(variables);

      setPromiseCache((previousPromiseCache) =>
        new Map(previousPromiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  const subscribeToMore: SubscribeToMoreFunction<
    TData | undefined,
    TVariables
  > = React.useCallback(
    (options) => queryRef.observable.subscribeToMore(options),
    [queryRef]
  );

  return React.useMemo<
    UseSuspenseQueryResult<TData | undefined, TVariables>
  >(() => {
    return {
      client,
      data: result.data,
      error: toApolloError(result),
      networkStatus: result.networkStatus,
      fetchMore,
      refetch,
      subscribeToMore,
    };
  }, [client, fetchMore, refetch, result, subscribeToMore]);
}

function validateOptions(options: WatchQueryOptions) {
  const { query, fetchPolicy, returnPartialData } = options;

  verifyDocumentType(query, DocumentType.Query);
  validateFetchPolicy(fetchPolicy);
  validatePartialDataReturn(fetchPolicy, returnPartialData);
}

function validateFetchPolicy(
  fetchPolicy: WatchQueryFetchPolicy = "cache-first"
) {
  const supportedFetchPolicies: WatchQueryFetchPolicy[] = [
    "cache-first",
    "network-only",
    "no-cache",
    "cache-and-network",
  ];

  invariant(
    supportedFetchPolicies.includes(fetchPolicy),
    `The fetch policy \`%s\` is not supported with suspense.`,
    fetchPolicy
  );
}

function validatePartialDataReturn(
  fetchPolicy: WatchQueryFetchPolicy | undefined,
  returnPartialData: boolean | undefined
) {
  if (fetchPolicy === "no-cache" && returnPartialData) {
    invariant.warn(
      "Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy."
    );
  }
}

export function toApolloError(result: ApolloQueryResult<any>) {
  return isNonEmptyArray(result.errors)
    ? new ApolloError({ graphQLErrors: result.errors })
    : result.error;
}

interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables,
> {
  client: ApolloClient<unknown>;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SkipToken | SuspenseQueryHookOptions<TData, TVariables>;
}

export function useWatchQueryOptions<
  TData,
  TVariables extends OperationVariables,
>({
  client,
  query,
  options,
}: UseWatchQueryOptionsHookOptions<TData, TVariables>): WatchQueryOptions<
  TVariables,
  TData
> {
  return useDeepMemo<WatchQueryOptions<TVariables, TData>>(() => {
    if (options === skipToken) {
      return { query, fetchPolicy: "standby" };
    }

    const fetchPolicy =
      options.fetchPolicy ||
      client.defaultOptions.watchQuery?.fetchPolicy ||
      "cache-first";

    const watchQueryOptions = {
      ...options,
      fetchPolicy,
      query,
      notifyOnNetworkStatusChange: false,
      nextFetchPolicy: void 0,
    };

    if (__DEV__) {
      validateOptions(watchQueryOptions);
    }

    // Assign the updated fetch policy after our validation since `standby` is
    // not a supported fetch policy on its own without the use of `skip`.
    if (options.skip) {
      watchQueryOptions.fetchPolicy = "standby";
    }

    return watchQueryOptions;
  }, [client, options, query]);
}
