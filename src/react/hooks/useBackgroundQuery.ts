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
  usePromiseVersion,
} from './useSuspenseQuery';
import type { FetchMoreFunction, RefetchFunction } from './useSuspenseQuery';
import { canonicalStringify } from '../../cache';

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

  const [version, setVersion] = usePromiseVersion();

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);

  const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  useTrackedQueryRefs(queryRef);

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

  // TODO(FIXME): refactor
  // @ts-ignore
  queryRef.setVersion = setVersion;
  queryRef.version = version;

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
  const promise = queryRef.promises[queryRef.version] || queryRef.promises.main;

  useEffect(() => {
    return queryRef.listen(() => {
      // TODO(FIXME): refactor
      // @ts-ignore
      queryRef.setVersion('main');
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
