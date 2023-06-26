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

type SuspenseQueryHookOptionsNoInfer<
  TData,
  TVariables extends OperationVariables
> = SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>;

export function useBackgroundQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends Omit<SuspenseQueryHookOptions<TData>, 'variables'>
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SuspenseQueryHookOptionsNoInfer<TData, TVariables> & TOptions
): UseBackgroundQueryResult<
  TOptions['errorPolicy'] extends 'ignore' | 'all'
    ? TOptions['returnPartialData'] extends true
      ? DeepPartial<TData> | undefined
      : TData | undefined
    : TOptions['returnPartialData'] extends true
    ? TOptions['skip'] extends boolean
      ? DeepPartial<TData> | undefined
      : DeepPartial<TData>
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
  options: SuspenseQueryHookOptionsNoInfer<TData, TVariables> & {
    returnPartialData: true;
    errorPolicy: 'ignore' | 'all';
  }
): UseBackgroundQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptionsNoInfer<TData, TVariables> & {
    errorPolicy: 'ignore' | 'all';
  }
): UseBackgroundQueryResult<TData | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptionsNoInfer<TData, TVariables> & {
    skip: boolean;
    returnPartialData: true;
  }
): UseBackgroundQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptionsNoInfer<TData, TVariables> & {
    returnPartialData: true;
  }
): UseBackgroundQueryResult<DeepPartial<TData>, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptionsNoInfer<TData, TVariables> & {
    skip: boolean;
  }
): UseBackgroundQueryResult<TData | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SuspenseQueryHookOptionsNoInfer<TData, TVariables>
): UseBackgroundQueryResult<TData, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptionsNoInfer<TData, TVariables> = Object.create(
    null
  )
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

export function useReadQuery<TData>(queryRef: QueryReference<TData>) {
  const [, forceUpdate] = useState(0);
  const internalQueryRef = queryRef[QUERY_REFERENCE_SYMBOL];
  invariant(
    internalQueryRef.promiseCache,
    'It appears that `useReadQuery` was used outside of `useBackgroundQuery`. ' +
      '`useReadQuery` is only supported for use with `useBackgroundQuery`. ' +
      'Please ensure you are passing the `queryRef` returned from `useBackgroundQuery`.'
  );

  const skipResult = useMemo(() => {
    const error = toApolloError(internalQueryRef.result);

    return {
      loading: false,
      data: internalQueryRef.result.data,
      networkStatus: error ? NetworkStatus.error : NetworkStatus.ready,
      error,
    };
  }, [internalQueryRef.result]);

  let promise = internalQueryRef.promiseCache.get(internalQueryRef.key);

  if (!promise) {
    promise = internalQueryRef.promise;
    internalQueryRef.promiseCache.set(internalQueryRef.key, promise);
  }

  useEffect(() => {
    return internalQueryRef.listen((promise) => {
      internalQueryRef.promiseCache!.set(internalQueryRef.key, promise);
      forceUpdate((prevState) => prevState + 1);
    });
  }, [queryRef]);

  const result =
    internalQueryRef.watchQueryOptions.fetchPolicy === 'standby'
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
