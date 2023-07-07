import * as React from 'react';
import type {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from '../../core/index.js';
import { useApolloClient } from './useApolloClient.js';
import {
  QUERY_REFERENCE_SYMBOL,
  type QueryReference,
} from '../cache/QueryReference.js';
import type { BackgroundQueryHookOptions, NoInfer } from '../types/types.js';
import { __use } from './internal/index.js';
import { useSuspenseCache } from './useSuspenseCache.js';
import { useWatchQueryOptions } from './useSuspenseQuery.js';
import type { FetchMoreFunction, RefetchFunction } from './useSuspenseQuery.js';
import { canonicalStringify } from '../../cache/index.js';
import type { DeepPartial } from '../../utilities/index.js';

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

type BackgroundQueryHookOptionsNoInfer<
  TData,
  TVariables extends OperationVariables
> = BackgroundQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>;

export function useBackgroundQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends Omit<BackgroundQueryHookOptions<TData>, 'variables'>
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & TOptions
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
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    returnPartialData: true;
    errorPolicy: 'ignore' | 'all';
  }
): UseBackgroundQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    errorPolicy: 'ignore' | 'all';
  }
): UseBackgroundQueryResult<TData | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    skip: boolean;
    returnPartialData: true;
  }
): UseBackgroundQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    returnPartialData: true;
  }
): UseBackgroundQueryResult<DeepPartial<TData>, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    skip: boolean;
  }
): UseBackgroundQueryResult<TData | undefined, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: BackgroundQueryHookOptionsNoInfer<TData, TVariables>
): UseBackgroundQueryResult<TData, TVariables>;

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> = Object.create(
    null
  )
): UseBackgroundQueryResult<TData> {
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const client = useApolloClient(options.client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  const cacheKey = (
    [client, query, canonicalStringify(variables)] as any[]
  ).concat(queryKey);

  const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
    client.watchQuery(watchQueryOptions)
  );

  const [promiseCache, setPromiseCache] = React.useState(
    () => new Map([[queryRef.key, queryRef.promise]])
  );

  if (queryRef.didChangeOptions(watchQueryOptions)) {
    const promise = queryRef.applyOptions(watchQueryOptions);
    promiseCache.set(queryRef.key, promise);
  }

  React.useEffect(() => {
    queryRef.retain();

    return () => {
      queryRef.dispose();
    };
  }, [queryRef]);

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      const promise = queryRef.fetchMore(options);

      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (variables) => {
      const promise = queryRef.refetch(variables);

      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  queryRef.promiseCache = promiseCache;

  return React.useMemo(() => {
    return [
      { [QUERY_REFERENCE_SYMBOL]: queryRef },
      {
        fetchMore,
        refetch,
      },
    ];
  }, [queryRef, fetchMore, refetch]);
}
