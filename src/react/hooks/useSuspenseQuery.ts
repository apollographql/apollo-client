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
  NetworkStatus,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  WatchQueryFetchPolicy,
} from '../../core';
import { invariant } from '../../utilities/globals';
import { compact, isNonEmptyArray } from '../../utilities';
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

  const { fetchPolicy, errorPolicy, returnPartialData, variables } =
    watchQueryOptions;

  let cacheEntry = suspenseCache.lookup(query, variables);

  const [observable] = useState(() => {
    return cacheEntry?.observable || client.watchQuery(watchQueryOptions);
  });

  const result = useObservableQueryResult(observable);

  // Sometimes the observable reports a network status of error even
  // when our error policy is set to 'ignore' or 'all'.
  // This patches the network status to avoid a rerender when the observable
  // first subscribes and gets back a ready network status.
  if (result.networkStatus === NetworkStatus.error && errorPolicy !== 'none') {
    result.networkStatus = NetworkStatus.ready;
  }

  const returnPartialResults =
    returnPartialData && result.partial && result.data;

  if (result.loading && !returnPartialResults) {
    switch (fetchPolicy) {
      case 'cache-and-network': {
        if (!result.partial) {
          break;
        }

        // fallthrough when data is not in the cache
      }
      default: {
        if (!cacheEntry) {
          const promise = observable.reobserve(watchQueryOptions);
          cacheEntry = suspenseCache.add(query, variables, {
            promise,
            observable,
          });
        }
        if (!cacheEntry.fulfilled) {
          throw cacheEntry.promise;
        }
      }
    }
  }

  if (result.error && errorPolicy === 'none') {
    throw result.error;
  }

  useEffect(() => {
    const { variables, query } = watchQueryOptions;
    const previousOpts = previousWatchQueryOptionsRef.current;

    if (variables !== previousOpts.variables || query !== previousOpts.query) {
      const promise = observable.reobserve({ query, variables });

      suspenseCache.add(query, variables, { promise, observable });
      previousWatchQueryOptionsRef.current = watchQueryOptions;
    }
  }, [watchQueryOptions]);

  useEffect(() => {
    return () => {
      suspenseCache.remove(query, variables);
    };
  }, [query, variables]);

  return useMemo(() => {
    return {
      data: result.data,
      error: errorPolicy === 'all' ? toApolloError(result) : void 0,
      fetchMore: (options) => {
        // console.log('fetchMore', options);
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
  const { query, fetchPolicy = DEFAULT_FETCH_POLICY } = options;

  verifyDocumentType(query, DocumentType.Query);
  validateFetchPolicy(fetchPolicy);
}

function validateFetchPolicy(fetchPolicy: WatchQueryFetchPolicy) {
  invariant(
    SUPPORTED_FETCH_POLICIES.includes(fetchPolicy),
    `The fetch policy \`${fetchPolicy}\` is not supported with suspense.`
  );
}

function toApolloError(result: ApolloQueryResult<any>) {
  return isNonEmptyArray(result.errors)
    ? new ApolloError({ graphQLErrors: result.errors })
    : result.error;
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

  const watchQueryOptions = useDeepMemo(() => {
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
      variables: compact({ ...defaultOptions?.variables, ...variables }),
    };
  }, [options, query, defaultOptions]);

  if (__DEV__) {
    validateOptions(watchQueryOptions);
  }

  return watchQueryOptions;
}

function useObservableQueryResult<TData>(observable: ObservableQuery<TData>) {
  const suspenseCache = useSuspenseCache();
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

        // ObservableQuery will call `reobserve` as soon as the first
        // subscription is created. Because we don't subscribe to the
        // observable until after we've suspended via the initial fetch, we
        // don't want to initiate another network request for fetch policies
        // that always fetch (e.g. 'network-only'). Instead, we set the cache
        // policy to `cache-only` to prevent the network request until the
        // subscription is created, then reset it back to its original.
        const originalFetchPolicy = observable.options.fetchPolicy;
        const cacheEntry = suspenseCache.lookup(
          observable.options.query,
          observable.options.variables
        );

        if (cacheEntry?.fulfilled) {
          observable.options.fetchPolicy = 'cache-only';
        }

        const subscription = observable.subscribe({
          next: handleUpdate,
          error: handleUpdate,
        });

        observable.options.fetchPolicy = originalFetchPolicy;

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
