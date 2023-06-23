import { useEffect, useState, useMemo, useCallback } from 'react';
import type {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { NetworkStatus } from '../../core';
import { useApolloClient } from './useApolloClient';
import {
  QUERY_REFERENCE_SYMBOL,
  type QueryReference,
} from '../cache/QueryReference';
import type { SuspenseQueryHookOptions, NoInfer } from '../types/types';
import { __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import {
  toApolloError,
  useTrackedQueryRefs,
  useWatchQueryOptions,
} from './useSuspenseQuery';
import type { FetchMoreFunction, RefetchFunction } from './useSuspenseQuery';
import { canonicalStringify } from '../../cache';
import type { DeepPartial } from '../../utilities';
import { invariant } from '../../utilities/globals';

export type UseBackgroundQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
> = [
  QueryReference<TData>,
  {
    fetchMore: FetchMoreFunction<TData, TVariables>;
    refetch: RefetchFunction<TData, TVariables>;
  }
];

export function useBackgroundQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends Omit<
    SuspenseQueryHookOptions<TData>,
    'variables' | 'returnPartialData' | 'refetchWritePolicy'
  >
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: Omit<
    SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
    'returnPartialData' | 'refetchWritePolicy'
  > &
    TOptions
): UseBackgroundQueryResult<
  TOptions['errorPolicy'] extends 'ignore' | 'all'
    ? TData | undefined
    : TOptions['skip'] extends boolean
    ? TData | undefined
    : TData,
  TVariables
>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: Omit<
    SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
    'returnPartialData' | 'refetchWritePolicy'
  > & {
    returnPartialData: true;
    errorPolicy: 'ignore' | 'all';
  }
): UseBackgroundQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: Omit<
    SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
    'returnPartialData' | 'refetchWritePolicy'
  > & {
    errorPolicy: 'ignore' | 'all';
  }
): UseBackgroundQueryResult<TData | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: Omit<
    SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
    'returnPartialData' | 'refetchWritePolicy'
  > & {
    skip: boolean;
  }
): UseBackgroundQueryResult<TData | undefined, TVariables>;

// TODO: support `returnPartialData` | `refetchWritePolicy`
// see https://github.com/apollographql/apollo-client/issues/10893

// export function useBackgroundQuery<
//   TData = unknown,
//   TVariables extends OperationVariables = OperationVariables
// >(
//   query: DocumentNode | TypedDocumentNode<TData, TVariables>,
//   options: Omit<
//     SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
//     'returnPartialData' | 'refetchWritePolicy'
//   > & {
//     returnPartialData: true;
//   }
// ): UseBackgroundQueryResult<DeepPartial<TData>, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: Omit<
    SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>,
    'returnPartialData' | 'refetchWritePolicy'
  >
): UseBackgroundQueryResult<TData, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: Omit<
    SuspenseQueryHookOptions<TData, TVariables>,
    'returnPartialData' | 'refetchWritePolicy'
  > = Object.create(null)
): UseBackgroundQueryResult<TData> {
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const client = useApolloClient(options.client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { fetchPolicy, variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);

  const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  const { fetchPolicy: currentFetchPolicy } = queryRef.watchQueryOptions;

  const [promiseCache, setPromiseCache] = useState(
    () => new Map([[queryRef.key, queryRef.promise]])
  );

  if (currentFetchPolicy === 'standby' && fetchPolicy !== currentFetchPolicy) {
    const promise = queryRef.reobserve({ fetchPolicy });
    promiseCache.set(queryRef.key, promise);
  }

  useTrackedQueryRefs(queryRef);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => {
      const promise = queryRef.fetchMore(options);

      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, promise)
      );

      return promise;
    },
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => {
      const promise = queryRef.refetch(variables);

      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, promise)
      );

      return promise;
    },
    [queryRef]
  );

  queryRef.promiseCache = promiseCache;

  return useMemo(() => {
    return [
      { [QUERY_REFERENCE_SYMBOL]: queryRef },
      {
        fetchMore,
        refetch,
      },
    ];
  }, [queryRef, fetchMore, refetch]);
}

export function useReadQuery<TData>(_queryRef: QueryReference<TData>) {
  const [, forceUpdate] = useState(0);
  const queryRef = _queryRef[QUERY_REFERENCE_SYMBOL];
  invariant(
    queryRef.promiseCache,
    'It appears that `useReadQuery` was used outside of `useBackgroundQuery`. ' +
      '`useReadQuery` is only supported for use with `useBackgroundQuery`. ' +
      'Please ensure you are passing the `queryRef` returned from `useBackgroundQuery`.'
  );

  const skipResult = useMemo(() => {
    const error = toApolloError(queryRef.result);

    return {
      loading: false,
      data: queryRef.result.data,
      networkStatus: error ? NetworkStatus.error : NetworkStatus.ready,
      error,
    };
  }, [queryRef.result]);

  let promise = queryRef.promiseCache.get(queryRef.key);

  if (!promise) {
    promise = queryRef.promise;
    queryRef.promiseCache.set(queryRef.key, promise);
  }

  useEffect(() => {
    return queryRef.listen((promise) => {
      queryRef.promiseCache!.set(queryRef.key, promise);
      forceUpdate((prevState) => prevState + 1);
    });
  }, [queryRef]);

  const result =
    queryRef.watchQueryOptions.fetchPolicy === 'standby'
      ? skipResult
      : __use(promise);

  return useMemo(() => {
    return {
      data: result.data,
      networkStatus: result.networkStatus,
      error: toApolloError(result),
    };
  }, [result]);
}
