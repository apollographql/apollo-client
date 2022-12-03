import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  useLayoutEffect,
} from 'react';
import { equal } from '@wry/equality';
import {
  ApolloClient,
  ApolloError,
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
} from '../../core';
import { invariant } from '../../utilities/globals';
import {
  compact,
  Concast,
  isNonEmptyArray,
  hasDirectives,
} from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { useDeepMemo } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { useSyncExternalStore } from './useSyncExternalStore';

export interface UseSuspenseQueryResult<
  TData = any,
  TVariables = OperationVariables
> {
  data: TData;
  error: ApolloError | undefined;
  fetchMore: ObservableQueryFields<TData, TVariables>['fetchMore'];
  refetch: ObservableQueryFields<TData, TVariables>['refetch'];
}

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
  const suspenseCache = useSuspenseCache();
  const client = useApolloClient(options.client);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  const previousWatchQueryOptionsRef = useRef(watchQueryOptions);
  const deferred = useIsDeferred(query);

  const { fetchPolicy, errorPolicy, returnPartialData, variables } =
    watchQueryOptions;

  let cacheEntry = suspenseCache.lookup(query, variables);

  const [observable] = useState(() => {
    return cacheEntry?.observable || client.watchQuery(watchQueryOptions);
  });

  const result = useObservableQueryResult(observable);

  const hasFullResult = result.data && !result.partial;
  const hasPartialResult = result.data && result.partial;
  const usePartialResult = returnPartialData && hasPartialResult;

  if (
    result.error &&
    errorPolicy === 'none' &&
    // If we've got a deferred query that errors on an incremental chunk, we
    // will have a partial result before the error is collected. We do not want
    // to throw errors that have been returned from incremental chunks. Instead
    // we offload those errors to the `error` property.
    (!deferred || !hasPartialResult)
  ) {
    throw result.error;
  }

  if (result.loading) {
    // If we don't have a cache entry, but we are in a loading state, we are on
    // the first run of the hook. Kick off a network request so we can suspend
    // immediately
    if (!cacheEntry) {
      cacheEntry = suspenseCache.add(query, variables, {
        promise: wrapConcastWithPromise(
          observable.reobserveAsConcast(watchQueryOptions),
          { deferred }
        ),
        observable,
      });
    }

    const hasUsableResult =
      // When we have partial data in the cache, a network request will be kicked
      // off to load the full set of data. Avoid suspending when the request is
      // in flight to return the partial data immediately.
      usePartialResult ||
      // `cache-and-network` kicks off a network request even with a full set of
      // data in the cache, which means the loading state will be set to `true`.
      // Avoid suspending in this case.
      (fetchPolicy === 'cache-and-network' && hasFullResult);

    if (!hasUsableResult && !cacheEntry.fulfilled) {
      throw cacheEntry.promise;
    }
  }

  useEffect(() => {
    const { variables, query } = watchQueryOptions;
    const previousOpts = previousWatchQueryOptionsRef.current;

    if (variables !== previousOpts.variables || query !== previousOpts.query) {
      suspenseCache.remove(previousOpts.query, previousOpts.variables);

      suspenseCache.add(query, variables, {
        promise: observable.reobserve({ query, variables }),
        observable,
      });

      previousWatchQueryOptionsRef.current = watchQueryOptions;
    }
  }, [watchQueryOptions]);

  useEffect(() => {
    return () => {
      suspenseCache.remove(query, variables);
    };
  }, []);

  return useMemo(() => {
    return {
      data: result.data,
      error: errorPolicy === 'ignore' ? void 0 : toApolloError(result),
      fetchMore: (options) => {
        const promise = observable.fetchMore(options);

        suspenseCache.add(query, watchQueryOptions.variables, {
          promise,
          observable,
        });

        return promise;
      },
      refetch: (variables?: Partial<TVariables>) => {
        const promise = observable.refetch(variables);

        suspenseCache.add(query, watchQueryOptions.variables, {
          promise,
          observable,
        });

        return promise;
      },
    };
  }, [result, observable, errorPolicy]);
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

function wrapConcastWithPromise<TData>(
  concast: Concast<ApolloQueryResult<TData>>,
  { deferred }: { deferred: boolean }
): Promise<ApolloQueryResult<TData>> {
  if (deferred) {
    return new Promise((resolve, reject) => {
      // Unlike `concast.promise`, we want to resolve the promise on the initial
      // chunk of the deferred query. This allows the component to unsuspend
      // when we get the initial set of data, rather than waiting until all
      // chunks have been loaded.
      const subscription = concast.subscribe({
        next: (value) => {
          resolve(value);
          subscription.unsubscribe();
        },
        error: reject,
      });
    });
  }

  return concast.promise;
}

interface UseWatchQueryOptionsHookOptions<TData, TVariables> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SuspenseQueryHookOptions<TData, TVariables>;
  client: ApolloClient<any>;
}

function useWatchQueryOptions<TData, TVariables>({
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
      notifyOnNetworkStatusChange: suspensePolicy === 'always',
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

function useIsDeferred(query: DocumentNode) {
  return useMemo(() => hasDirectives(['defer'], query), [query]);
}

function useObservableQueryResult<TData>(observable: ObservableQuery<TData>) {
  const resultRef = useRef<ApolloQueryResult<TData>>();
  const isMountedRef = useRef(false);

  if (!resultRef.current) {
    resultRef.current = observable.getCurrentResult();
  }

  // React keeps refs and effects from useSyncExternalStore around after the
  // component initially mounts even if the component re-suspends. We need to
  // track when the component suspends/unsuspends to ensure we don't try and
  // update the component while its suspended since the observable's
  // `next` function is called before the promise resolved.
  //
  // Unlike useEffect, useLayoutEffect will run its cleanup and initialization
  // functions each time a component is suspended.
  useLayoutEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useSyncExternalStore(
    useCallback(
      (forceUpdate) => {
        function handleUpdate() {
          const previousResult = resultRef.current!;
          const result = observable.getCurrentResult();

          if (
            previousResult.loading === result.loading &&
            previousResult.networkStatus === result.networkStatus &&
            equal(previousResult.data, result.data)
          ) {
            return;
          }

          resultRef.current = result;

          if (isMountedRef.current) {
            forceUpdate();
          }
        }

        const subscription = observable.subscribe({
          next: handleUpdate,
          error: handleUpdate,
        });

        return () => {
          subscription.unsubscribe();
        };
      },
      [observable]
    ),
    () => resultRef.current!,
    () => resultRef.current!
  );
}
