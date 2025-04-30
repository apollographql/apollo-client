import * as React from "react";

import type {
  ApolloClient,
  ApolloQueryResult,
  DefaultContext,
  DocumentNode,
  ErrorLike,
  ErrorPolicy,
  OperationVariables,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "@apollo/client";
import type { SubscribeToMoreFunction } from "@apollo/client";
import { NetworkStatus } from "@apollo/client";
import { canonicalStringify } from "@apollo/client/cache";
import type { MaybeMasked } from "@apollo/client/masking";
import type {
  CacheKey,
  FetchMoreFunction,
  QueryKey,
  RefetchFunction,
} from "@apollo/client/react/internal";
import { getSuspenseCache } from "@apollo/client/react/internal";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type {
  DeepPartial,
  NoInfer,
  VariablesOption,
} from "@apollo/client/utilities/internal";

import type { SkipToken } from "./constants.js";
import { skipToken } from "./constants.js";
import { __use, useDeepMemo, wrapHook } from "./internal/index.js";
import { validateSuspenseHookOptions } from "./internal/validateSuspenseHookOptions.js";
import { useApolloClient } from "./useApolloClient.js";

export declare namespace useSuspenseQuery {
  export type FetchPolicy = Extract<
    WatchQueryFetchPolicy,
    "cache-first" | "network-only" | "no-cache" | "cache-and-network"
  >;

  export type Options<
    TVariables extends OperationVariables = OperationVariables,
  > = {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
    client?: ApolloClient;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
    returnPartialData?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy_suspense:member} */
    refetchWritePolicy?: RefetchWritePolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: FetchPolicy;

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
  } & VariablesOption<TVariables>;

  export interface Result<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
    client: ApolloClient;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
    data: MaybeMasked<TData>;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#error:member} */
    error: ErrorLike | undefined;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#fetchMore:member} */
    fetchMore: FetchMoreFunction<TData, TVariables>;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#networkStatus:member} */
    networkStatus: NetworkStatus;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#refetch:member} */
    refetch: RefetchFunction<TData, TVariables>;

    /** {@inheritDoc @apollo/client!QueryResultDocumentation#subscribeToMore:member} */
    subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
  }
}

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useSuspenseQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: true;
    errorPolicy: "ignore" | "all";
  }
): useSuspenseQuery.Result<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useSuspenseQuery.Options<NoInfer<TVariables>> & {
    errorPolicy: "ignore" | "all";
  }
): useSuspenseQuery.Result<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useSuspenseQuery.Options<NoInfer<TVariables>> & {
    skip: boolean;
    returnPartialData: true;
  }
): useSuspenseQuery.Result<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useSuspenseQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: true;
  }
): useSuspenseQuery.Result<DeepPartial<TData>, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useSuspenseQuery.Options<NoInfer<TVariables>> & {
    skip: boolean;
  }
): useSuspenseQuery.Result<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (useSuspenseQuery.Options<NoInfer<TVariables>> & {
        returnPartialData: true;
      })
): useSuspenseQuery.Result<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [options?: useSuspenseQuery.Options<NoInfer<TVariables>>]
  : [options: useSuspenseQuery.Options<NoInfer<TVariables>>]
): useSuspenseQuery.Result<TData, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [options?: SkipToken | useSuspenseQuery.Options<NoInfer<TVariables>>]
  : [options: SkipToken | useSuspenseQuery.Options<NoInfer<TVariables>>]
): useSuspenseQuery.Result<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken | useSuspenseQuery.Options<NoInfer<TVariables>>
): useSuspenseQuery.Result<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SkipToken | useSuspenseQuery.Options<NoInfer<TVariables>>
): useSuspenseQuery.Result<TData | undefined, TVariables> {
  return wrapHook(
    "useSuspenseQuery",
    // eslint-disable-next-line react-compiler/react-compiler
    useSuspenseQuery_,
    useApolloClient(typeof options === "object" ? options.client : undefined)
  )(query, options ?? ({} as any));
}

function useSuspenseQuery_<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | (SkipToken & Partial<useSuspenseQuery.Options<TVariables>>)
    | useSuspenseQuery.Options<TVariables>
): useSuspenseQuery.Result<TData | undefined, TVariables> {
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
    // eslint-disable-next-line react-compiler/react-compiler
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

  const skipResult = React.useMemo<ApolloQueryResult<TData>>(() => {
    const error = queryRef.result.error;
    const complete = !!queryRef.result.data;

    return {
      loading: false,
      data: queryRef.result.data,
      networkStatus: error ? NetworkStatus.error : NetworkStatus.ready,
      error,
      complete,
      partial: !complete,
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

  // TODO: The internalQueryRef doesn't have TVariables' type information so we have to cast it here
  const subscribeToMore = queryRef.observable
    .subscribeToMore as SubscribeToMoreFunction<TData | undefined, TVariables>;

  return React.useMemo<
    useSuspenseQuery.Result<TData | undefined, TVariables>
  >(() => {
    return {
      client,
      data: result.data,
      error: result.error,
      networkStatus: result.networkStatus,
      fetchMore,
      refetch,
      subscribeToMore,
    };
  }, [client, fetchMore, refetch, result, subscribeToMore]);
}

interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables,
> {
  client: ApolloClient;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SkipToken | useSuspenseQuery.Options<TVariables>;
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
      return { query, fetchPolicy: "standby" } as WatchQueryOptions<
        TVariables,
        TData
      >;
    }

    const fetchPolicy =
      options.fetchPolicy ||
      client.defaultOptions.watchQuery?.fetchPolicy ||
      "cache-first";

    const watchQueryOptions: WatchQueryOptions<TVariables, TData> = {
      ...options,
      fetchPolicy,
      query,
      notifyOnNetworkStatusChange: false,
      nextFetchPolicy: void 0,
    };

    if (__DEV__) {
      validateSuspenseHookOptions(watchQueryOptions);
    }

    // Assign the updated fetch policy after our validation since `standby` is
    // not a supported fetch policy on its own without the use of `skip`.
    if (options.skip) {
      watchQueryOptions.fetchPolicy = "standby";
    }

    return watchQueryOptions;
  }, [client, options, query]);
}
