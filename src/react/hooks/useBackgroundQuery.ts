import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  ApolloClient,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  ApolloQueryResult,
  ObservableQuery,
} from '../../core';
import { compact } from '../../utilities';
import { invariant } from '../../utilities/globals';
import { useApolloClient } from './useApolloClient';
import { QuerySubscription } from '../cache/QuerySubscription';
import { useSyncExternalStore } from './useSyncExternalStore';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { useDeepMemo, useStrictModeSafeCleanupEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { SuspenseCache } from '../cache';
import { canonicalStringify } from '../../cache';

const DEFAULT_FETCH_POLICY = 'cache-first';
const DEFAULT_SUSPENSE_POLICY = 'always';
const DEFAULT_ERROR_POLICY = 'none';

//////////////////////
// ⌘C + ⌘P from uSQ //
//////////////////////
type FetchMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['fetchMore'];

type RefetchFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['refetch'];

interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables
> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SuspenseQueryHookOptions<TData, TVariables>;
  client: ApolloClient<any>;
}

function useTrackedSubscriptions(subscription: QuerySubscription) {
  const trackedSubscriptions = useRef(new Set<QuerySubscription>());

  trackedSubscriptions.current.add(subscription);

  return function dispose() {
    trackedSubscriptions.current.forEach((sub) => sub.dispose());
  };
}

// posible re-naming: useSuspenseWatchQueryOptions to indicate
// they're a bit more limited due to Suspense use cases
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
    return {
      ...options,
      query,
      notifyOnNetworkStatusChange: false,
    };
  }, [options, query, defaultOptions]);

  return watchQueryOptions;
}
/////////
// End //
/////////
export interface UseBackgroundQueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
> {
  subscription: QuerySubscription<TData>;
  // observable: ObservableQuery<TData, TVariables>;
  fetchMore: ObservableQueryFields<TData, TVariables>['fetchMore'];
  refetch: ObservableQueryFields<TData, TVariables>['refetch'];
}

export function useBackgroundQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseBackgroundQueryResult<TData> {
  const suspenseCache = useSuspenseCache();
  const client = useApolloClient(options.client);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  const { variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);

  const subscription = suspenseCache.getSubscription(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  const dispose = useTrackedSubscriptions(subscription);
  useStrictModeSafeCleanupEffect(dispose);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => subscription.fetchMore(options) as any,
    [subscription]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => subscription.refetch(variables),
    [subscription]
  );
  const version = 'main';
  subscription.version = version;
  return useMemo(() => {
    return {
      // this won't work with refetch/fetchMore...
      subscription,
      fetchMore,
      refetch,
    };
  }, [subscription, fetchMore, refetch]);
}

export function useReadQuery<TData>(subscription: QuerySubscription<TData>) {
  const [, forceUpdate] = useState(0);
  const promise =
    subscription.promises[subscription.version] || subscription.promises.main;

  useEffect(() => {
    return subscription.listen(() => {
      forceUpdate((prevState) => prevState + 1);
    });
  }, [subscription]);

  const result = __use(promise);

  // TBD: refetch/fetchMore

  return result;
}
