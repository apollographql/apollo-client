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
  type InternalQueryReference,
} from '../cache/QueryReference.js';
import type { BackgroundQueryHookOptions, NoInfer } from '../types/types.js';
import { __use } from './internal/index.js';
import { getSuspenseCache } from '../cache/index.js';
import { useWatchQueryOptions } from './useSuspenseQuery.js';
import type { FetchMoreFunction } from './useSuspenseQuery.js';
import { canonicalStringify } from '../../cache/index.js';
import type { DeepPartial } from '../../utilities/index.js';
import type { CacheKey } from '../cache/types.js';

type LoadQuery<TVariables extends OperationVariables> = (
  ...args: [TVariables] extends [never] ? [] : [TVariables]
) => void;

export type UseBackgroundQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
> = [
  QueryReference<TData> | null,
  LoadQuery<TVariables>,
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
  const client = useApolloClient(options.client);
  const suspenseCache = getSuspenseCache(client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { queryKey = [] } = options;

  const [queryRef, setQueryRef] =
    React.useState<InternalQueryReference<TData> | null>(null);

  const [promiseCache, setPromiseCache] = React.useState(() =>
    queryRef ? new Map([[queryRef.key, queryRef.promise]]) : new Map()
  );

  if (queryRef) {
    queryRef.promiseCache = promiseCache;
  }

  React.useEffect(() => queryRef?.retain(), [queryRef]);

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      if (!queryRef) {
        throw new Error(
          'The query has not been loaded. Please load the query.'
        );
      }

      const promise = queryRef.fetchMore(options);

      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (options) => {
      if (!queryRef) {
        throw new Error(
          'The query has not been loaded. Please load the query.'
        );
      }

      const promise = queryRef.refetch(options);

      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  const loadQuery: LoadQuery<TVariables> = React.useCallback(
    (...args) => {
      const [variables] = args;

      const cacheKey: CacheKey = [
        query,
        canonicalStringify(variables),
        ...([] as any[]).concat(queryKey),
      ];

      const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
        client.watchQuery({ ...watchQueryOptions, variables })
      );

      promiseCache.set(queryRef.key, queryRef.promise);
      setQueryRef(queryRef);
    },
    [query, queryKey, suspenseCache, watchQueryOptions, promiseCache]
  );

  return React.useMemo(() => {
    return [
      queryRef && { [QUERY_REFERENCE_SYMBOL]: queryRef },
      loadQuery,
      { fetchMore, refetch },
    ];
  }, [queryRef, loadQuery, fetchMore]);
}
