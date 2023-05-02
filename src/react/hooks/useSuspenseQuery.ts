import { invariant, __DEV__ } from '../../utilities/globals';
import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import {
  ApolloClient,
  ApolloError,
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
  NetworkStatus,
  FetchMoreQueryOptions,
} from '../../core';
import { DeepPartial, isNonEmptyArray } from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
  NoInfer,
} from '../types/types';
import { useDeepMemo, useStrictModeSafeCleanupEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { QuerySubscription } from '../cache/QuerySubscription';
import { canonicalStringify } from '../../cache';

export interface UseSuspenseQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
> {
  client: ApolloClient<any>;
  data: TData;
  error: ApolloError | undefined;
  fetchMore: FetchMoreFunction<TData, TVariables>;
  networkStatus: NetworkStatus;
  refetch: RefetchFunction<TData, TVariables>;
  subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
}

type FetchMoreFunction<TData, TVariables extends OperationVariables> = (
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

type RefetchFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['refetch'];

type SubscribeToMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['subscribeToMore'];

type Version = 'main' | 'network';

export function useSuspenseQuery_experimental<
  TData,
  TVariables extends OperationVariables,
  TOptions extends Omit<SuspenseQueryHookOptions<TData>, 'variables'>
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> &
    TOptions
): UseSuspenseQueryResult<
  TOptions['errorPolicy'] extends 'ignore' | 'all'
    ? TOptions['returnPartialData'] extends true
      ? DeepPartial<TData> | undefined
      : TData | undefined
    : TOptions['returnPartialData'] extends true
    ? DeepPartial<TData>
    : TData,
  TVariables
>;

export function useSuspenseQuery_experimental<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
    errorPolicy: 'ignore' | 'all';
  }
): UseSuspenseQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery_experimental<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    errorPolicy: 'ignore' | 'all';
  }
): UseSuspenseQueryResult<TData | undefined, TVariables>;

export function useSuspenseQuery_experimental<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
  }
): UseSuspenseQueryResult<DeepPartial<TData>, TVariables>;

export function useSuspenseQuery_experimental<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
): UseSuspenseQueryResult<TData, TVariables>;

export function useSuspenseQuery_experimental<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<
    NoInfer<TData>,
    NoInfer<TVariables>
  > = Object.create(null)
): UseSuspenseQueryResult<TData, TVariables> {
  const client = useApolloClient(options.client);
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const watchQueryOptions = useWatchQueryOptions({ query, options });
  const { variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  const [version, setVersion] = usePromiseVersion();

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);

  const subscription = suspenseCache.getSubscription(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  useTrackedSubscriptions(subscription);

  useEffect(() => {
    return subscription.listen(() => {
      setVersion('main');
    });
  }, [subscription]);

  const promise = subscription.promises[version] || subscription.promises.main;
  const result = __use(promise);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => {
      const promise = subscription.fetchMore(options);
      setVersion('network');
      return promise;
    },
    [subscription]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => {
      const promise = subscription.refetch(variables);
      setVersion('network');
      return promise;
    },
    [subscription]
  );

  const subscribeToMore: SubscribeToMoreFunction<TData, TVariables> =
    useCallback(
      (options) => subscription.observable.subscribeToMore(options),
      [subscription]
    );

  return useMemo(() => {
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
  fetchPolicy: WatchQueryFetchPolicy = 'cache-first'
) {
  const supportedFetchPolicies: WatchQueryFetchPolicy[] = [
    'cache-first',
    'network-only',
    'no-cache',
    'cache-and-network',
  ];

  invariant(
    supportedFetchPolicies.includes(fetchPolicy),
    `The fetch policy \`${fetchPolicy}\` is not supported with suspense.`
  );
}

function validatePartialDataReturn(
  fetchPolicy: WatchQueryFetchPolicy | undefined,
  returnPartialData: boolean | undefined
) {
  if (fetchPolicy === 'no-cache' && returnPartialData) {
    invariant.warn(
      'Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy.'
    );
  }
}

function toApolloError(result: ApolloQueryResult<any>) {
  return isNonEmptyArray(result.errors)
    ? new ApolloError({ graphQLErrors: result.errors })
    : result.error;
}

function useTrackedSubscriptions(subscription: QuerySubscription) {
  const trackedSubscriptions = useRef(new Set<QuerySubscription>());

  trackedSubscriptions.current.add(subscription);

  useStrictModeSafeCleanupEffect(() => {
    trackedSubscriptions.current.forEach((sub) => sub.dispose());
  });
}

function usePromiseVersion() {
  // Use an object as state to force React to re-render when we publish an
  // update to the same version (such as sequential cache updates).
  const [{ version }, setState] = useState<{ version: Version }>({
    version: 'main',
  });

  const setVersion = useCallback(
    (version: Version) => setState({ version }),
    []
  );

  return [version, setVersion] as const;
}

interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables
> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SuspenseQueryHookOptions<TData, TVariables>;
}

function useWatchQueryOptions<TData, TVariables extends OperationVariables>({
  query,
  options,
}: UseWatchQueryOptionsHookOptions<TData, TVariables>): WatchQueryOptions<
  TVariables,
  TData
> {
  const watchQueryOptions = useDeepMemo<WatchQueryOptions<TVariables, TData>>(
    () => ({
      ...options,
      query,
      notifyOnNetworkStatusChange: false,
      nextFetchPolicy: void 0,
    }),
    [options, query]
  );

  if (__DEV__) {
    validateOptions(watchQueryOptions);
  }

  return watchQueryOptions;
}
