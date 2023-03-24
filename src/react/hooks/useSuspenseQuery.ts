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
  FetchMoreQueryOptions,
} from '../../core';
import { isNonEmptyArray } from '../../utilities';
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
import { QuerySubscription } from '../cache/QuerySubscription';

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
> = (fetchMoreOptions: FetchMoreQueryOptions<TVariables, TData> & {
  updateQuery?: (
    previousQueryResult: TData,
    options: {
      fetchMoreResult: TData;
      variables: TVariables;
    },
  ) => TData;
}) => Promise<ApolloQueryResult<TData>>;

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
  const didPreviouslySuspend = useRef(false);
  const client = useApolloClient(options.client);
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const watchQueryOptions = useWatchQueryOptions({ query, options });
  const { returnPartialData = false, variables } = watchQueryOptions;
  const { suspensePolicy = 'always' } = options;
  const shouldSuspend =
    suspensePolicy === 'always' || !didPreviouslySuspend.current;

  const subscription = suspenseCache.getSubscription(
    client,
    query,
    variables,
    () => client.watchQuery(watchQueryOptions)
  );

  const dispose = useTrackedSubscriptions(subscription);

  useStrictModeSafeCleanupEffect(dispose);

  let result = useSyncExternalStore(
    subscription.listen,
    () => subscription.result,
    () => subscription.result
  );

  const previousVariables = useRef(variables);
  const previousData = useRef(result.data);

  if (!equal(variables, previousVariables.current)) {
    if (result.networkStatus !== NetworkStatus.ready) {
      // Since we now create separate ObservableQuery instances per unique
      // query + variables combination, we need to manually insert the previous
      // data into the returned result to mimic the behavior when changing
      // variables from a single ObservableQuery, where the previous result was
      // held onto until the request was finished.
      result = {
        ...result,
        data: previousData.current,
        networkStatus: NetworkStatus.setVariables,
      };
    }

    previousVariables.current = variables;
    previousData.current = result.data;
  }

  if (
    result.networkStatus === NetworkStatus.error ||
    (shouldSuspend &&
      !shouldUseCachedResult(subscription.result, {
        returnPartialData,
        fetchPolicy: options.fetchPolicy,
      }))
  ) {
    // Intentionally ignore the result returned from __use since we want to
    // observe results from the observable instead of the the promise.
    __use(subscription.promise);
  }

  didPreviouslySuspend.current = true;

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => subscription.fetchMore(options),
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
    () => ({ ...options, query, notifyOnNetworkStatusChange: true }),
    [options, query]
  );

  if (__DEV__) {
    validateOptions(watchQueryOptions);
  }

  return watchQueryOptions;
}

function shouldUseCachedResult(
  result: ApolloQueryResult<unknown>,
  {
    returnPartialData,
    fetchPolicy,
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

  switch (fetchPolicy) {
    // The default fetch policy is cache-first, so we can treat undefined as
    // such.
    case void 0:
    case 'cache-first':
    case 'cache-and-network': {
      return Boolean(result.data && (!result.partial || returnPartialData));
    }
    default:
      return false;
  }
}
