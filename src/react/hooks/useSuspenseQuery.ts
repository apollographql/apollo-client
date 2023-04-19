import { invariant, __DEV__ } from '../../utilities/globals';
import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
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
import { isNonEmptyArray } from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { useDeepMemo, useStrictModeSafeCleanupEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { QuerySubscription } from '../cache/QuerySubscription';
import { canonicalStringify } from '../../cache';

export interface UseSuspenseQueryResult<
  TData = any,
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

export function useSuspenseQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData, TVariables> {
  const client = useApolloClient(options.client);
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const watchQueryOptions = useWatchQueryOptions({ query, options });
  const { variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);

  const subscription = suspenseCache.getSubscription(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  const [[channel], setChannel] = useState<['main' | 'refetch']>(['main']);

  const dispose = useTrackedSubscriptions(subscription);

  useStrictModeSafeCleanupEffect(dispose);

  const result = __use(subscription.getPromise(channel));

  useEffect(() => {
    return subscription.listen(() => {
      setChannel(['main']);
    });
  }, [subscription]);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => {
      setChannel(['refetch']);
      return subscription.fetchMore(options);
    },
    [subscription]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => {
      setChannel(['refetch']);
      return subscription.refetch(variables);
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

  return function dispose() {
    trackedSubscriptions.current.forEach((sub) => sub.dispose());
  };
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
