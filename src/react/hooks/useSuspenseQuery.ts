import * as React from 'react';
import equal from '@wry/equality';
import { invariant } from '../../utilities/globals/index.js';
import type {
  ApolloClient,
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
  FetchMoreQueryOptions,
  WatchQueryOptions,
} from '../../core/index.js';
import { ApolloError, NetworkStatus } from '../../core/index.js';
import type { DeepPartial } from '../../utilities/index.js';
import {
  createFulfilledPromise,
  isNonEmptyArray,
} from '../../utilities/index.js';
import { useApolloClient } from './useApolloClient.js';
import { DocumentType, verifyDocumentType } from '../parser/index.js';
import type {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
  NoInfer,
} from '../types/types.js';
import { __use } from './internal/index.js';
import { getSuspenseCache } from '../cache/index.js';
import { canonicalStringify } from '../../cache/index.js';
import { skipToken, type SkipToken } from './constants.js';

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

export function useSuspenseQuery<
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
    ? TOptions['skip'] extends boolean
      ? DeepPartial<TData> | undefined
      : DeepPartial<TData>
    : TOptions['skip'] extends boolean
    ? TData | undefined
    : TData,
  TVariables
>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
    errorPolicy: 'ignore' | 'all';
  }
): UseSuspenseQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    errorPolicy: 'ignore' | 'all';
  }
): UseSuspenseQueryResult<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    skip: boolean;
    returnPartialData: true;
  }
): UseSuspenseQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    returnPartialData: true;
  }
): UseSuspenseQueryResult<DeepPartial<TData>, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
    skip: boolean;
  }
): UseSuspenseQueryResult<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
): UseSuspenseQueryResult<TData, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>> & {
        returnPartialData: true;
      })
): UseSuspenseQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?:
    | SkipToken
    | SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
): UseSuspenseQueryResult<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | SuspenseQueryHookOptions<
        NoInfer<TData>,
        NoInfer<TVariables>
      > = Object.create(null)
): UseSuspenseQueryResult<TData | undefined, TVariables> {
  const client = useApolloClient(
    options === skipToken ? void 0 : options.client
  );

  useValidateOptions(query, options);

  const fetchPolicy: WatchQueryFetchPolicy =
    options === skipToken || options.skip
      ? 'standby'
      : options.fetchPolicy ||
        client.defaultOptions.watchQuery?.fetchPolicy ||
        'cache-first';

  const watchQueryOptions =
    options === skipToken ? { fetchPolicy } : { ...options, fetchPolicy };

  const queryRef = getSuspenseCache(client).getQueryRef(
    [
      query,
      canonicalStringify(watchQueryOptions.variables),
      ...([] as any[]).concat(watchQueryOptions.queryKey ?? []),
    ],
    () =>
      client.watchQuery({
        ...watchQueryOptions,
        query,
        fetchPolicy,
        ...WATCH_QUERY_OPTION_OVERRIDES,
      })
  );

  const [promiseCache, setPromiseCache] = React.useState(
    () => new Map([[queryRef.key, queryRef.promise]])
  );

  let promise = promiseCache.get(queryRef.key);

  if (queryRef.didChangeOptions(watchQueryOptions)) {
    promise = queryRef.applyOptions(watchQueryOptions);
    promiseCache.set(queryRef.key, promise);
  }

  if (!promise) {
    promise = queryRef.promise;
    promiseCache.set(queryRef.key, promise);
  }

  React.useEffect(() => {
    const dispose = queryRef.retain();

    const removeListener = queryRef.listen((promise) => {
      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, promise)
      );
    });

    return () => {
      removeListener();
      dispose();
    };
  }, [queryRef]);

  const skipResult = React.useMemo(
    () => toFulfilledQueryResult(queryRef.result),
    [queryRef.result]
  );

  const result = __use(fetchPolicy === 'standby' ? skipResult : promise);

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      const promise = queryRef.fetchMore(options);

      setPromiseCache((previousPromiseCache) =>
        new Map(previousPromiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (variables) => {
      const promise = queryRef.refetch(variables);

      setPromiseCache((previousPromiseCache) =>
        new Map(previousPromiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  const subscribeToMore: SubscribeToMoreFunction<TData, TVariables> =
    React.useCallback(
      (options) => queryRef.observable.subscribeToMore(options),
      [queryRef]
    );

  return React.useMemo(() => {
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

const WATCH_QUERY_OPTION_OVERRIDES: Partial<WatchQueryOptions> = {
  notifyOnNetworkStatusChange: false,
  nextFetchPolicy: void 0,
};

function validateOptions(
  query: SkipToken | DocumentNode,
  options: SkipToken | SuspenseQueryHookOptions
) {
  if (query !== skipToken) {
    verifyDocumentType(query, DocumentType.Query);
  }

  if (options !== skipToken) {
    const { fetchPolicy } = options;

    validateFetchPolicy(fetchPolicy);
    validatePartialDataReturn(fetchPolicy, options.returnPartialData);
  }
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
    `The fetch policy \`%s\` is not supported with suspense.`,
    fetchPolicy
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

function toFulfilledQueryResult<TData>(
  result: ApolloQueryResult<TData> | undefined
) {
  const error = result ? toApolloError(result) : void 0;

  return createFulfilledPromise({
    loading: false,
    data: result?.data,
    networkStatus: error ? NetworkStatus.error : NetworkStatus.ready,
    error,
  });
}

function useValidateOptions(
  query: SkipToken | DocumentNode,
  options: SkipToken | SuspenseQueryHookOptions
) {
  if (__DEV__) {
    const ref =
      React.useRef<
        [SkipToken | DocumentNode, SkipToken | SuspenseQueryHookOptions]
      >();

    if (!equal(ref.current, [query, options])) {
      ref.current = [query, options];
      validateOptions(query, options);
    }
  }
}
