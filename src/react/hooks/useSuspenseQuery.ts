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
  ApolloError,
  ApolloQueryResult,
  DocumentNode,
  NetworkStatus,
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
  const isSuspendedRef = useIsSuspendedRef();
  const watchQueryOptions: WatchQueryOptions<TVariables, TData> =
    useDeepMemo(() => {
      const {
        errorPolicy,
        fetchPolicy,
        suspensePolicy = DEFAULT_SUSPENSE_POLICY,
        variables,
        ...watchQueryOptions
      } = options;

      const {
        watchQuery: defaultOptions = Object.create(
          null
        ) as Partial<WatchQueryOptions>,
      } = client.defaultOptions;

      return {
        ...watchQueryOptions,
        query,
        errorPolicy:
          errorPolicy || defaultOptions.errorPolicy || DEFAULT_ERROR_POLICY,
        fetchPolicy:
          fetchPolicy || defaultOptions.fetchPolicy || DEFAULT_FETCH_POLICY,
        notifyOnNetworkStatusChange: suspensePolicy === 'always',
        variables: compact({ ...defaultOptions.variables, ...variables }),
      };
    }, [options, query, client.defaultOptions.watchQuery]);
  const { fetchPolicy, errorPolicy, returnPartialData } = watchQueryOptions;

  if (__DEV__) {
    validateOptions(watchQueryOptions);
  }

  const [observable] = useState(() => {
    return (
      suspenseCache.getQuery(query) ||
      suspenseCache.registerQuery(query, client.watchQuery(watchQueryOptions))
    );
  });

  const resultRef = useRef<ApolloQueryResult<TData>>();
  const previousWatchQueryOptionsRef = useRef(watchQueryOptions);

  if (!resultRef.current) {
    resultRef.current = observable.getCurrentResult();
  }

  let cacheEntry = suspenseCache.getVariables(observable, observable.variables);

  const result = useSyncExternalStore(
    useCallback(
      (forceUpdate) => {
        // ObservableQuery will call `reobserve` as soon as the first
        // subscription is created. Because we don't subscribe to the
        // observable until after we've suspended via the initial fetch, we
        // don't want to initiate another network request for fetch policies
        // that always fetch (e.g. 'network-only'). Instead, we set the cache
        // policy to `cache-only` to prevent the network request until the
        // subscription is created, then reset it back to its original.
        const originalFetchPolicy = watchQueryOptions.fetchPolicy;

        if (cacheEntry?.fulfilled) {
          observable.options.fetchPolicy = 'cache-only';
        }

        function onNext() {
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

          if (!isSuspendedRef.current) {
            forceUpdate();
          }
        }

        function onError() {
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

          if (!isSuspendedRef.current) {
            forceUpdate();
          }
        }

        const subscription = observable.subscribe(onNext, onError);

        observable.options.fetchPolicy = originalFetchPolicy;

        return () => {
          subscription.unsubscribe();
          suspenseCache.deregisterQuery(query);
        };
      },
      [observable]
    ),
    () => resultRef.current!,
    () => resultRef.current!
  );

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
    switch (watchQueryOptions.fetchPolicy) {
      case 'cache-and-network': {
        if (!result.partial) {
          break;
        }

        // fallthrough when data is not in the cache
      }
      default: {
        if (!cacheEntry) {
          const promise = observable.reobserve(watchQueryOptions);
          cacheEntry = suspenseCache.setVariables(
            observable,
            observable.variables,
            promise
          );
        }
        if (!cacheEntry.fulfilled) {
          isSuspendedRef.current = true;
          throw cacheEntry.promise;
        }
      }
    }
  }

  if (result.error && errorPolicy === 'none') {
    throw result.error;
  }

  // Unlike useEffect, useLayoutEffect will run its effects again when
  // resuspending a component. This ensures we can detect when we've resumed
  // rendering after suspending the component.
  useLayoutEffect(() => {
    isSuspendedRef.current = false;
  }, []);

  useEffect(() => {
    const { variables, query } = watchQueryOptions;

    if (
      variables !== previousWatchQueryOptionsRef.current?.variables ||
      query !== previousWatchQueryOptionsRef.current.query
    ) {
      const promise = observable.reobserve(watchQueryOptions);

      suspenseCache.setVariables(observable, variables, promise);
      previousWatchQueryOptionsRef.current = watchQueryOptions;
    }
  }, [watchQueryOptions]);

  return useMemo(() => {
    return {
      data: result.data,
      error: errorPolicy === 'all' ? toApolloError(result) : void 0,
      fetchMore: (options) => {
        // console.log('fetchMore', options);
        const promise = observable.fetchMore(options);

        suspenseCache.setVariables(observable, observable.variables, promise);

        return promise;
      },
      refetch: (variables?: Partial<TVariables>) => {
        const promise = observable.refetch(variables);

        suspenseCache.setVariables(observable, observable.variables, promise);

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

function useIsSuspendedRef() {
  const ref = useRef(false);

  // Unlike useEffect, useLayoutEffect will run its cleanup and initialization
  // functions each time a component is resuspended. Using this ensures we can
  // detect when a component has resumed after having been suspended.
  useLayoutEffect(() => {
    ref.current = false;

    return () => {
      ref.current = true;
    };
  }, []);

  return ref;
}
