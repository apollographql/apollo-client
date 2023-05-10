import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { useApolloClient } from './useApolloClient';
import { QuerySubscription } from '../cache/QuerySubscription';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import {
  toApolloError,
  FetchMoreFunction,
  RefetchFunction,
  useTrackedSubscriptions,
  useWatchQueryOptions,
  usePromiseVersion,
} from './useSuspenseQuery';
import { canonicalStringify } from '../../cache';

export interface UseBackgroundQueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
> {
  subscription: QuerySubscription<TData>;
  fetchMore: FetchMoreFunction<TData, TVariables>;
  refetch: ObservableQueryFields<TData, TVariables>['refetch'];
}

export function useBackgroundQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  // TODO: narrow `SuspenseQueryHookOptions`
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseBackgroundQueryResult<TData> {
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const client = useApolloClient(options.client);
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

  subscription.version = version;

  return useMemo(() => {
    return {
      subscription,
      fetchMore,
      refetch,
    };
  }, [subscription, fetchMore, refetch]);
}

export function useReadQuery_experimental<TData>(
  subscription: QuerySubscription<TData>
) {
  const [, forceUpdate] = useState(0);
  const promise =
    subscription.promises[subscription.version] || subscription.promises.main;

  useEffect(() => {
    return subscription.listen(() => {
      forceUpdate((prevState) => prevState + 1);
    });
  }, [subscription]);

  const result = __use(promise);

  return useMemo(() => {
    return {
      data: result.data,
      networkStatus: result.networkStatus,
      error: toApolloError(result),
    };
  }, [result]);
}
