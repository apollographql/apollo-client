import { invariant, __DEV__ } from '../../utilities/globals';
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { equal } from '@wry/equality';
import {
  ApolloClient,
  ApolloError,
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
  NetworkStatus,
} from '../../core';
import { compact, isNonEmptyArray } from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
  SuspensePolicy,
} from '../types/types';
import { useDeepMemo, useIsomorphicLayoutEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { useSyncExternalStore } from './useSyncExternalStore';
import { ObservableQuerySubscription } from '../cache';

export interface UseSuspenseQueryResult<
  TData = any,
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

type FetchMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['fetchMore'];

type RefetchFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['refetch'];

type SubscribeToMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['subscribeToMore'];

const SUPPORTED_FETCH_POLICIES: WatchQueryFetchPolicy[] = [
  'cache-first',
  'network-only',
  'no-cache',
  'cache-and-network',
];

const DEFAULT_FETCH_POLICY = 'cache-first';
const DEFAULT_SUSPENSE_POLICY = 'always';
const DEFAULT_ERROR_POLICY = 'none';

export function useSuspenseQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData, TVariables> {
  const client = useApolloClient(options.client);
  const suspenseCache = useSuspenseCache(options.suspenseCache);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  const { errorPolicy, variables } = watchQueryOptions;

  const queryCache = suspenseCache.forClient(client);
  const subscription = queryCache.getSubscription(
    queryCache.getCacheKey(query, variables),
    () => new ObservableQuerySubscription(client.watchQuery(watchQueryOptions))
  );

  const observable = subscription.observable;
  const result = useSubscriptionResult(subscription);

  const [promise, setPromise] = usePromise(subscription, {
    query,
    returnPartialData: watchQueryOptions.returnPartialData ?? false,
    suspensePolicy: options.suspensePolicy ?? DEFAULT_SUSPENSE_POLICY,
    variables: watchQueryOptions.variables,
  });

  console.dir({ render: { result, promise, variables } }, { depth: null });

  // Intentionally ignore the result returned from __use since we want to
  // observe results from the observable instead of the the promise.
  if (promise) {
    __use(subscription.promise);
  }

  // useEffect(() => {
  //   return () => {
  //     queryCache.remove(query, variables);
  //   };
  // }, []);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => {
      const promise = observable.fetchMore(options);

      setPromise(promise);

      return promise;
    },
    [observable]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => {
      const promise = observable.refetch(variables);

      setPromise(promise);

      return promise;
    },
    [observable]
  );

  const subscribeToMore: SubscribeToMoreFunction<TData, TVariables> =
    useCallback((options) => observable.subscribeToMore(options), [observable]);

  return useMemo(() => {
    return {
      client,
      data: result.data,
      error: errorPolicy === 'ignore' ? void 0 : toApolloError(result),
      networkStatus: result.networkStatus,
      fetchMore,
      refetch,
      subscribeToMore,
    };
  }, [
    client,
    fetchMore,
    refetch,
    result,
    observable,
    errorPolicy,
    subscribeToMore,
  ]);
}

function validateOptions(options: WatchQueryOptions) {
  const {
    query,
    fetchPolicy = DEFAULT_FETCH_POLICY,
    returnPartialData,
  } = options;

  verifyDocumentType(query, DocumentType.Query);
  validateFetchPolicy(fetchPolicy);
  validatePartialDataReturn(fetchPolicy, returnPartialData);
}

function validateFetchPolicy(fetchPolicy: WatchQueryFetchPolicy) {
  invariant(
    SUPPORTED_FETCH_POLICIES.includes(fetchPolicy),
    `The fetch policy \`${fetchPolicy}\` is not supported with suspense.`
  );
}

function validatePartialDataReturn(
  fetchPolicy: WatchQueryFetchPolicy,
  returnPartialData: boolean | undefined
) {
  if (fetchPolicy === 'no-cache' && returnPartialData) {
    invariant.warn(
      'Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy.'
    );
  }
}

function toApolloError(result: ApolloQueryResult<any>) {
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
  client: ApolloClient<any>;
}

function useWatchQueryOptions<TData, TVariables extends OperationVariables>({
  query,
  options,
  client,
}: UseWatchQueryOptionsHookOptions<TData, TVariables>): WatchQueryOptions<
  TVariables,
  TData
> {
  const { watchQuery: defaultOptions } = client.defaultOptions;

  const watchQueryOptions = useDeepMemo<
    WatchQueryOptions<TVariables, TData>
  >(() => {
    const {
      errorPolicy,
      fetchPolicy,
      suspensePolicy = DEFAULT_SUSPENSE_POLICY,
      variables,
      ...watchQueryOptions
    } = options;

    return {
      ...watchQueryOptions,
      query,
      errorPolicy:
        errorPolicy || defaultOptions?.errorPolicy || DEFAULT_ERROR_POLICY,
      fetchPolicy:
        fetchPolicy || defaultOptions?.fetchPolicy || DEFAULT_FETCH_POLICY,
      notifyOnNetworkStatusChange: true, // suspensePolicy === 'always',
      // By default, `ObservableQuery` will run `reobserve` the first time
      // something `subscribe`s to the observable, which kicks off a network
      // request. This creates a problem for suspense because we need to begin
      // fetching the data immediately so we can throw the promise on the first
      // render. Since we don't subscribe until after we've unsuspended, we need
      // to avoid kicking off another network request for the same data we just
      // fetched. This option toggles that behavior off to avoid the `reobserve`
      // when the observable is first subscribed to.
      fetchOnFirstSubscribe: false,
      variables: compact({ ...defaultOptions?.variables, ...variables }),
    };
  }, [options, query, defaultOptions]);

  if (__DEV__) {
    validateOptions(watchQueryOptions);
  }

  return watchQueryOptions;
}

function shouldAttachPromise(
  result: Pick<ApolloQueryResult<unknown>, 'data' | 'partial'>,
  { returnPartialData }: { returnPartialData: boolean }
) {
  const hasFullResult = result.data && !result.partial;
  const hasPartialResult = result.data && result.partial;
  const usePartialResult = returnPartialData && hasPartialResult;

  return !hasFullResult && !usePartialResult;
}

// function shouldReadFromCache(fetchPolicy: WatchQueryFetchPolicy) {
//   return fetchPolicy === 'cache-first' || fetchPolicy === 'cache-and-network';
// }

interface UsePromiseOptions<TVariables extends OperationVariables> {
  returnPartialData: boolean;
  suspensePolicy: SuspensePolicy;
  variables: TVariables | undefined;
  query: DocumentNode;
}

function usePromise<TData, TVariables extends OperationVariables>(
  subscription: ObservableQuerySubscription<TData>,
  {
    returnPartialData,
    suspensePolicy,
    query,
    variables,
  }: UsePromiseOptions<TVariables>
) {
  const previousVariablesRef = useRef(variables);
  const previousQueryRef = useRef(query);

  const ref = useRef<Promise<ApolloQueryResult<TData>> | null | undefined>();

  // If the ref is `undefined`, we are running the hook for the first time
  if (ref.current === void 0) {
    ref.current = null;

    const result = subscription.result;

    // If we are running the hook for the first time and are in a loading state,
    // we are unable to pull results from the cache, so we need to kick off the
    // query.
    if (result.networkStatus === NetworkStatus.loading) {
      if (shouldAttachPromise(result, { returnPartialData })) {
        ref.current = subscription.promise;
      }
    }
  }

  if (!equal(variables, previousVariablesRef.current)) {
    ref.current = null;

    const promise = subscription.promise;
    const result = subscription.result;

    if (
      shouldAttachPromise(result, { returnPartialData }) &&
      suspensePolicy === 'always'
    ) {
      ref.current = promise;
    }

    previousVariablesRef.current = variables;
  }

  if (!equal(query, previousQueryRef.current)) {
    ref.current = null;

    const promise = subscription.promise;
    const result = subscription.result;

    if (
      shouldAttachPromise(result, { returnPartialData }) &&
      suspensePolicy === 'always'
    ) {
      ref.current = promise;
    }

    previousQueryRef.current = query;
  }

  // const [, forceUpdate] = useState(0);

  function setPromise(promise: Promise<ApolloQueryResult<TData>> | null) {
    // ref.current = suspensePolicy === 'always' ? promise : null;
    // forceUpdate((c) => c + 1);
  }

  return [ref.current, setPromise] as const;
}

function useSubscriptionResult<TData>(
  subscription: ObservableQuerySubscription<TData>
) {
  const isMountedRef = useRef(false);

  // React keeps refs and effects from useSyncExternalStore around after the
  // component initially mounts even if the component re-suspends. We need to
  // track when the component suspends/unsuspends to ensure we don't try and
  // update the component while its suspended since the observable's
  // `next` function is called before the promise resolved.
  //
  // Unlike useEffect, useLayoutEffect will run its cleanup and initialization
  // functions each time a component is suspended.
  useIsomorphicLayoutEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useSyncExternalStore(
    useCallback(
      (forceUpdate) => {
        return subscription.subscribe(() => {
          if (isMountedRef.current) {
            forceUpdate();
          }
        });
      },
      [subscription]
    ),
    () => subscription.result,
    () => subscription.result
  );
}
