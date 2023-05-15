import { invariant, __DEV__ } from '../../utilities/globals';
import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import type {
  ApolloClient,
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
  NetworkStatus,
  FetchMoreQueryOptions} from '../../core';
import {
  ApolloError
} from '../../core';
import type { DeepPartial} from '../../utilities';
import { isNonEmptyArray } from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import type {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
  NoInfer,
} from '../types/types';
import { useDeepMemo, useStrictModeSafeCleanupEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import type { QueryReference } from '../cache/QueryReference';
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
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['refetch'];

export type SubscribeToMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['subscribeToMore'];

export type Version = 'main' | 'network';

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

  const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  useTrackedQueryRefs(queryRef);

  useEffect(() => {
    return queryRef.listen(() => {
      setVersion('main');
    });
  }, [queryRef]);

  const promise = queryRef.promises[version] || queryRef.promises.main;
  const result = __use(promise);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => {
      const promise = queryRef.fetchMore(options);
      setVersion('network');
      return promise;
    },
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => {
      const promise = queryRef.refetch(variables);
      setVersion('network');
      return promise;
    },
    [queryRef]
  );

  const subscribeToMore: SubscribeToMoreFunction<TData, TVariables> =
    useCallback(
      (options) => queryRef.observable.subscribeToMore(options),
      [queryRef]
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

export function toApolloError(result: ApolloQueryResult<any>) {
  return isNonEmptyArray(result.errors)
    ? new ApolloError({ graphQLErrors: result.errors })
    : result.error;
}

export function useTrackedQueryRefs(queryRef: QueryReference) {
  const trackedQueryRefs = useRef(new Set<QueryReference>());

  trackedQueryRefs.current.add(queryRef);

  useStrictModeSafeCleanupEffect(() => {
    trackedQueryRefs.current.forEach((sub) => sub.dispose());
  });
}

export function usePromiseVersion() {
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

export function useWatchQueryOptions<TData, TVariables extends OperationVariables>({
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
