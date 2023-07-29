import * as React from 'react';
import type {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from '../../core/index.js';
import { useApolloClient } from './useApolloClient.js';
import { wrapQueryRef, type QueryReference } from '../cache/QueryReference.js';
import type { BackgroundQueryHookOptions, NoInfer } from '../types/types.js';
import { __use } from './internal/index.js';
import { getSuspenseCache } from '../cache/index.js';
import { useWatchQueryOptions } from './useSuspenseQuery.js';
import type { FetchMoreFunction, RefetchFunction } from './useSuspenseQuery.js';
import { canonicalStringify } from '../../cache/index.js';
import type { DeepPartial } from '../../utilities/index.js';
import type { CacheKey } from '../cache/types.js';
import { skipToken, type SkipToken } from './constants.js';

export type UseBackgroundQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
> = {
  fetchMore: FetchMoreFunction<TData, TVariables>;
  refetch: RefetchFunction<TData, TVariables>;
};

type BackgroundQueryHookOptionsNoInfer<
  TData,
  TVariables extends OperationVariables
> = BackgroundQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>;

type BackgroundQueryHookData<
  TData,
  TOptions extends BackgroundQueryHookOptions<TData>
> = TOptions['errorPolicy'] extends 'ignore' | 'all'
  ? TOptions['returnPartialData'] extends true
    ? DeepPartial<TData> | undefined
    : TData | undefined
  : TOptions['returnPartialData'] extends true
  ? DeepPartial<TData>
  : TData;

export function useBackgroundQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends Omit<BackgroundQueryHookOptions<TData>, 'variables'>
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & TOptions
): TOptions['skip'] extends boolean
  ? [
      QueryReference<BackgroundQueryHookData<TData, TOptions>> | undefined,
      UseBackgroundQueryResult<TData, TVariables>
    ]
  : [
      QueryReference<BackgroundQueryHookData<TData, TOptions>>,
      UseBackgroundQueryResult<TData, TVariables>
    ];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    returnPartialData: true;
    errorPolicy: 'ignore' | 'all';
  }
): [
  QueryReference<DeepPartial<TData> | undefined>,
  UseBackgroundQueryResult<TData, TVariables>
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    errorPolicy: 'ignore' | 'all';
  }
): [
  QueryReference<TData | undefined>,
  UseBackgroundQueryResult<TData, TVariables>
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    skip: boolean;
    returnPartialData: true;
  }
): [
  QueryReference<DeepPartial<TData>> | undefined,
  UseBackgroundQueryResult<TData, TVariables>
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    returnPartialData: true;
  }
): [
  QueryReference<DeepPartial<TData>>,
  UseBackgroundQueryResult<TData, TVariables>
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    skip: boolean;
  }
): [
  QueryReference<TData> | undefined,
  UseBackgroundQueryResult<TData, TVariables>
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: BackgroundQueryHookOptionsNoInfer<TData, TVariables>
): [QueryReference<TData>, UseBackgroundQueryResult<TData, TVariables>];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken
): [
  QueryReference<TData> | undefined,
  UseBackgroundQueryResult<TData, TVariables>
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
        returnPartialData: true;
      })
): [
  QueryReference<DeepPartial<TData>> | undefined,
  UseBackgroundQueryResult<TData, TVariables>
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SkipToken | BackgroundQueryHookOptionsNoInfer<TData, TVariables>
): [
  QueryReference<TData> | undefined,
  UseBackgroundQueryResult<TData, TVariables>
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | BackgroundQueryHookOptionsNoInfer<TData, TVariables> = Object.create(null)
): [
  QueryReference<TData> | undefined,
  UseBackgroundQueryResult<TData, TVariables>
] {
  const client = useApolloClient(
    options === skipToken ? void 0 : options.client
  );
  const suspenseCache = getSuspenseCache(client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { fetchPolicy, variables } = watchQueryOptions;
  const queryKey = options === skipToken ? [] : options.queryKey ?? [];

  // We are in a skipped state when the `fetchPolicy` is set to `standby`. We
  // only want to return `undefined` for the `queryRef` the first time we
  // skip. Once switched to `skip: false`, we can always return the query ref
  // to return the last result.
  const didFetchResult = React.useRef(fetchPolicy !== 'standby');
  didFetchResult.current ||= fetchPolicy !== 'standby';

  const cacheKey: CacheKey = [
    query,
    canonicalStringify(variables),
    ...([] as any[]).concat(queryKey),
  ];

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

  React.useEffect(() => queryRef.retain(), [queryRef]);

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

  return [
    didFetchResult.current ? wrapQueryRef(queryRef) : void 0,
    { fetchMore, refetch },
  ];
}
