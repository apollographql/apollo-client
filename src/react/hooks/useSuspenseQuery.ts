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
import { __use, useDeepMemo, wrapHook } from "./internal/index.js";
import { getSuspenseCache } from "../internal/index.js";
import { canonicalStringify } from "../../cache/index.js";
import { skipToken } from "./constants.js";
import type { SkipToken } from "./constants.js";
import type { CacheKey, QueryKey } from "../internal/index.js";

export interface UseSuspenseQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  client: ApolloClient<any>;
  data: TData;
  error: ApolloError | undefined;
  fetchMore: FetchMoreFunction<TData, TVariables>;
  networkStatus: NetworkStatus;
  refetch: RefetchFunction<TData, TVariables>;
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
  TOptions["errorPolicy"] extends "ignore" | "all" ?
    TOptions["returnPartialData"] extends true ?
      DeepPartial<TData> | undefined
    : TData | undefined
  : TOptions["returnPartialData"] extends true ?
    TOptions["skip"] extends boolean ?
      DeepPartial<TData> | undefined
    : DeepPartial<TData>
  : TOptions["skip"] extends boolean ? TData | undefined
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
  return wrapHook(
    "useSuspenseQuery",
    _useSuspenseQuery,
    useApolloClient(typeof options === "object" ? options.client : undefined)
  )(query, options);
}

function _useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | (SkipToken & Partial<SuspenseQueryHookOptions<TData, TVariables>>)
    | SuspenseQueryHookOptions<TData, TVariables>
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

  let [current, setPromise] = React.useState<
    [QueryKey, Promise<ApolloQueryResult<any>>]
  >([queryRef.key, queryRef.promise]);

  // This saves us a re-execution of the render function when a variable changed.
  if (current[0] !== queryRef.key) {
    current[0] = queryRef.key;
    current[1] = queryRef.promise;
  }
  let promise = current[1];

  if (queryRef.didChangeOptions(watchQueryOptions)) {
    current[1] = promise = queryRef.applyOptions(watchQueryOptions);
  }

  React.useEffect(() => {
    const dispose = queryRef.retain();

    const removeListener = queryRef.listen((promise) => {
      setPromise([queryRef.key, promise]);
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

  const fetchMore = React.useCallback<
    FetchMoreFunction<unknown, OperationVariables>
  >(
    (options) => {
      const promise = queryRef.fetchMore(options);
      setPromise([queryRef.key, queryRef.promise]);

      return promise;
    },
    [queryRef]
  ) as FetchMoreFunction<TData | undefined, TVariables>;

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (variables) => {
      const promise = queryRef.refetch(variables);
      setPromise([queryRef.key, queryRef.promise]);

      return promise;
    },
    [queryRef]
  );

  const subscribeToMore = queryRef.observable.subscribeToMore;

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
  return isNonEmptyArray(result.errors) ?
      new ApolloError({ graphQLErrors: result.errors })
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
