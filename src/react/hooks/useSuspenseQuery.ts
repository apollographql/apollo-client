import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  DependencyList,
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
import { compact } from '../../utilities';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import { SuspenseQueryHookOptions } from '../types/types';
import { useSuspenseCache } from './useSuspenseCache';
import { useSyncExternalStore } from './useSyncExternalStore';

export interface UseSuspenseQueryResult<
  TData = any,
  TVariables = OperationVariables
> {
  data: TData;
  error: ApolloError | undefined;
  variables: TVariables;
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
  const hasRunValidations = useRef(false);
  const client = useApolloClient(options.client);
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
  const { errorPolicy, variables } = watchQueryOptions;

  if (!hasRunValidations.current) {
    validateOptions(watchQueryOptions);
    hasRunValidations.current = true;
  }

  const [observable] = useState(() => {
    return (
      suspenseCache.getQuery(query) ||
      suspenseCache.registerQuery(query, client.watchQuery(watchQueryOptions))
    );
  });

  const resultRef = useRef<ApolloQueryResult<TData>>();
  const previousOptsRef = useRef(watchQueryOptions);

  if (!resultRef.current) {
    resultRef.current = observable.getCurrentResult();
  }

  let cacheEntry = suspenseCache.getVariables(observable, variables);

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

        if (cacheEntry?.resolved) {
          observable.options.fetchPolicy = 'cache-only';
        }

        const subscription = observable.subscribe(() => {
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
          forceUpdate();
        });

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
  // when our error policy is set to ignore or all.
  // This patches the network status to avoid a rerender when the observable
  // first subscribes and gets back a ready network status.
  if (
    result.networkStatus === NetworkStatus.error &&
    (errorPolicy === 'ignore' || errorPolicy === 'all')
  ) {
    result.networkStatus = NetworkStatus.ready;
  }

  if (result.loading) {
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
            watchQueryOptions.variables,
            promise
          );
        }
        if (!cacheEntry.resolved) {
          throw cacheEntry.promise;
        }
      }
    }
  }

  if (result.error && watchQueryOptions.errorPolicy === 'none') {
    throw result.error;
  }

  useEffect(() => {
    if (
      watchQueryOptions.variables !== previousOptsRef.current?.variables ||
      watchQueryOptions.query !== previousOptsRef.current.query
    ) {
      const promise = observable.reobserve(watchQueryOptions);

      suspenseCache.setVariables(
        observable,
        watchQueryOptions.variables,
        promise
      );
      previousOptsRef.current = watchQueryOptions;
    }
  }, [watchQueryOptions.variables, watchQueryOptions.query]);

  return useMemo(() => {
    return {
      data: result.data,
      error: observable.options.errorPolicy === 'all' ? result.error : void 0,
      variables: observable.variables as TVariables,
    };
  }, [result, observable]);
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

function useDeepMemo<TValue>(memoFn: () => TValue, deps: DependencyList) {
  const ref = useRef<{ deps: DependencyList; value: TValue }>();

  if (!ref.current || !equal(ref.current.deps, deps)) {
    ref.current = { value: memoFn(), deps };
  }

  return ref.current.value;
}
