import { invariant, __DEV__ } from '../../utilities/globals';
import { equal } from '@wry/equality';
import { useRef, useCallback, useMemo } from 'react';
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
} from '../../core';
import { compact, isNonEmptyArray } from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import {
  SuspenseQueryHookFetchPolicy,
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { useDeepMemo, useStrictModeSafeCleanupEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { useSyncExternalStore } from './useSyncExternalStore';
import { QuerySubscription } from '../cache';

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

type FetchMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['fetchMore'];

type RefetchFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['refetch'];

type SubscribeToMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['subscribeToMore'];

const SUPPORTED_FETCH_POLICIES: WatchQueryFetchPolicy[] = [
  'cache-first',
  'network-only',
  'no-cache',
  'cache-and-network',
];

const DEFAULT_FETCH_POLICY = 'cache-first';
const DEFAULT_SUSPENSE_POLICY = 'always';
const DEFAULT_ERROR_POLICY = 'none';

export function useSuspenseQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData, TVariables> {
  const didPreviouslySuspend = useRef(false);
  const client = useApolloClient(options.client);
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  const { returnPartialData = false, variables } = watchQueryOptions;
  const { suspensePolicy = DEFAULT_SUSPENSE_POLICY } = options;
  const shouldSuspend =
    suspensePolicy === 'always' || !didPreviouslySuspend.current;

  const previousVariables = useRef(variables);

  const subscription = suspenseCache
    .forClient(client)
    .getSubscription(query, variables, (client) =>
      client.watchQuery(watchQueryOptions)
    );

  const dispose = useTrackedSubscriptions(subscription);

  useStrictModeSafeCleanupEffect(dispose);

  let result = useSyncExternalStore(
    subscription.listen,
    () => subscription.result,
    () => subscription.result
  );

  if (!equal(variables, previousVariables.current)) {
    result = { ...result, networkStatus: NetworkStatus.setVariables };
    previousVariables.current = variables;
  }

  if (
    shouldSuspend &&
    !useCachedResult(subscription.result, {
      returnPartialData,
      fetchPolicy: options.fetchPolicy,
    })
  ) {
    // Intentionally ignore the result returned from __use since we want to
    // observe results from the observable instead of the the promise.
    __use(subscription.promise);
  }

  didPreviouslySuspend.current = true;

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => subscription.fetchMore(options) as any,
    [subscription]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => subscription.refetch(variables),
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
  const {
    query,
    fetchPolicy = DEFAULT_FETCH_POLICY,
    returnPartialData,
  } = options;

  verifyDocumentType(query, DocumentType.Query);
  validateFetchPolicy(fetchPolicy);
  validatePartialDataReturn(fetchPolicy, returnPartialData);
}

function validateFetchPolicy(fetchPolicy: WatchQueryFetchPolicy) {
  invariant(
    SUPPORTED_FETCH_POLICIES.includes(fetchPolicy),
    `The fetch policy \`${fetchPolicy}\` is not supported with suspense.`
  );
}

function validatePartialDataReturn(
  fetchPolicy: WatchQueryFetchPolicy,
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
  client: ApolloClient<any>;
}

function useWatchQueryOptions<TData, TVariables extends OperationVariables>({
  query,
  options,
  client,
}: UseWatchQueryOptionsHookOptions<TData, TVariables>): WatchQueryOptions<
  TVariables,
  TData
> {
  const { watchQuery: defaultOptions } = client.defaultOptions;

  const watchQueryOptions = useDeepMemo<
    WatchQueryOptions<TVariables, TData>
  >(() => {
    const {
      errorPolicy,
      fetchPolicy,
      suspensePolicy = DEFAULT_SUSPENSE_POLICY,
      variables,
      ...watchQueryOptions
    } = options;

    return {
      ...watchQueryOptions,
      query,
      errorPolicy:
        errorPolicy || defaultOptions?.errorPolicy || DEFAULT_ERROR_POLICY,
      fetchPolicy:
        fetchPolicy || defaultOptions?.fetchPolicy || DEFAULT_FETCH_POLICY,
      notifyOnNetworkStatusChange: true,
      variables: compact({ ...defaultOptions?.variables, ...variables }),
    };
  }, [options, query, defaultOptions]);

  if (__DEV__) {
    validateOptions(watchQueryOptions);
  }

  return watchQueryOptions;
}

function useCachedResult(
  result: ApolloQueryResult<unknown>,
  {
    returnPartialData = false,
    fetchPolicy = DEFAULT_FETCH_POLICY,
  }: {
    returnPartialData: boolean | undefined;
    fetchPolicy: SuspenseQueryHookFetchPolicy | undefined;
  }
) {
  if (
    result.networkStatus === NetworkStatus.refetch ||
    result.networkStatus === NetworkStatus.fetchMore ||
    result.networkStatus === NetworkStatus.error
  ) {
    return false;
  }

  const hasFullResult = result.data && !result.partial;
  const hasPartialResult = result.data && result.partial;
  const usePartialResult = returnPartialData && hasPartialResult;

  switch (fetchPolicy) {
    case 'cache-first':
    case 'cache-and-network':
      return hasFullResult || usePartialResult;
    default:
      return false;
  }
}
