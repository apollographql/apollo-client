import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  ApolloClient,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  ApolloQueryResult,
  FetchMoreQueryOptions,
} from '../../core';
import { useApolloClient } from './useApolloClient';
import { QuerySubscription } from '../cache/QuerySubscription';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { useDeepMemo, useStrictModeSafeCleanupEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { canonicalStringify } from '../../cache';

//////////////////////
// ⌘C + ⌘P from uSQ //
//////////////////////
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

type Version = 'main' | 'network';

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

/////////
// End //
/////////

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
  // TODO: does `SuspenseQueryHookOptions` need to be narrowed here?
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseBackgroundQueryResult<TData> {
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const client = useApolloClient(options.client);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  const { variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  const [version, setVersion] = usePromiseVersion();

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);

  const subscription = suspenseCache.getSubscription(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  const dispose = useTrackedSubscriptions(subscription);
  useStrictModeSafeCleanupEffect(dispose);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => {
      const promise = subscription.fetchMore(options);
      setVersion('network');
      return promise;
    },
    [subscription]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => subscription.refetch(variables),
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

  // TBD: refetch/fetchMore

  return result;
}
