import * as React from 'react';
import equal from '@wry/equality';
import { invariant } from '../../utilities/globals/index.js';
import type {
  ApolloClient,
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
  FetchMoreQueryOptions,
} from '../../core/index.js';
import { ApolloError, NetworkStatus } from '../../core/index.js';
import type { DeepPartial } from '../../utilities/index.js';
import { isNonEmptyArray } from '../../utilities/index.js';
import { useApolloClient } from './useApolloClient.js';
import { DocumentType, verifyDocumentType } from '../parser/index.js';
import type {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
  NoInfer,
} from '../types/types.js';
import { useDeepMemo, __use } from './internal/index.js';
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
  query: SkipToken | DocumentNode | TypedDocumentNode<TData, TVariables>,
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
  query: SkipToken | DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?:
    | SkipToken
    | SuspenseQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>
): UseSuspenseQueryResult<TData | undefined, TVariables>;

export function useSuspenseQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables
>(
  query: SkipToken | DocumentNode | TypedDocumentNode<TData, TVariables>,
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
  const watchQueryOptions = useWatchQueryOptions({ query, options });

  useValidateOptions(query, options);

  const fetchPolicy: WatchQueryFetchPolicy = options.skip
    ? 'standby'
    : options.fetchPolicy ||
      client.defaultOptions.watchQuery?.fetchPolicy ||
      'cache-first';

  const queryRef = getSuspenseCache(client).getQueryRef(
    [
      query,
      canonicalStringify(options.variables),
      ...([] as any[]).concat(options.queryKey ?? []),
    ],
    () => client.watchQuery({ ...watchQueryOptions, fetchPolicy })
  );

  const [promiseCache, setPromiseCache] = React.useState(
    () => new Map([[queryRef.key, queryRef.promise]])
  );

  let promise = promiseCache.get(queryRef.key);

  if (queryRef.didChangeOptions({ ...watchQueryOptions, fetchPolicy })) {
    promise = queryRef.applyOptions({ ...watchQueryOptions, fetchPolicy });
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

  const skipResult = React.useMemo(() => {
    const error = toApolloError(queryRef.result);

    return {
      loading: false,
      data: queryRef.result.data,
      networkStatus: error ? NetworkStatus.error : NetworkStatus.ready,
      error,
    };
  }, [queryRef.result]);

  const result = fetchPolicy === 'standby' ? skipResult : __use(promise);

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

interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables
> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SuspenseQueryHookOptions<TData, TVariables>;
}

function useValidateOptions(
  query: DocumentNode,
  options: SuspenseQueryHookOptions
) {
  if (__DEV__) {
    const ref = React.useRef<[DocumentNode, SuspenseQueryHookOptions]>();

    if (!equal(ref.current, [query, options])) {
      ref.current = [query, options];
      validateOptions({ ...options, query });
    }
  }
}

export function useWatchQueryOptions<
  TData,
  TVariables extends OperationVariables
>({
  query,
  options,
}: UseWatchQueryOptionsHookOptions<TData, TVariables>): WatchQueryOptions<
  TVariables,
  TData
> {
  return useDeepMemo<WatchQueryOptions<TVariables, TData>>(() => {
    const watchQueryOptions = {
      ...options,
      query,
      notifyOnNetworkStatusChange: false,
      nextFetchPolicy: void 0,
    };

    return watchQueryOptions;
  }, [options, query]);
}
