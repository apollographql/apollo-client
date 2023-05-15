import { useEffect, useState, useMemo, useCallback } from 'react';
import type {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { useApolloClient } from './useApolloClient';
import type { QueryReference } from '../cache/QueryReference';
import type {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import {
  toApolloError,
  useTrackedQueryRefs,
  useWatchQueryOptions,
} from './useSuspenseQuery';
import type { FetchMoreFunction, RefetchFunction } from './useSuspenseQuery';
import { canonicalStringify } from '../../cache';
import { invariant } from '../../utilities/globals';

export type UseBackgroundQueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
> = [
  QueryReference<TData>,
  {
    fetchMore: FetchMoreFunction<TData, TVariables>;
    refetch: ObservableQueryFields<TData, TVariables>['refetch'];
  }
];

export function useBackgroundQuery_experimental<
  TData = any,
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
  const watchQueryOptions = useWatchQueryOptions({ query, options });
  const { variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);

  const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  const [promiseCache, setPromiseCache] = useState(
    () => new Map([[queryRef.key, queryRef.promise]])
  );

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
      queryRef,
      {
        fetchMore,
        refetch,
      },
    ];
  }, [queryRef, fetchMore, refetch]);
}

export function useReadQuery_experimental<TData>(
  queryRef: QueryReference<TData>
) {
  const [, forceUpdate] = useState(0);

  invariant(
    queryRef.promiseCache,
    'It appears that `useReadQuery` was used outside of `useBackgroundQuery`. ' +
      '`useReadQuery` is only supported for use with `useBackgroundQuery`. ' +
      'Please ensure you are passing the `queryRef` returned from `useBackgroundQuery`.'
  );

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

  const result = __use(promise);

  return useMemo(() => {
    return {
      data: result.data,
      networkStatus: result.networkStatus,
      error: toApolloError(result),
    };
  }, [result]);
}
