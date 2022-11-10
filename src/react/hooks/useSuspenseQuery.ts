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
  ApolloQueryResult,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import { SuspenseQueryHookOptions } from '../types/types';
import { useSuspenseCache } from './useSuspenseCache';
import { useSyncExternalStore } from './useSyncExternalStore';

type FetchPolicy = SuspenseQueryHookOptions['fetchPolicy'];

export interface UseSuspenseQueryResult<
  TData = any,
  TVariables = OperationVariables
> {
  data: TData;
  variables: TVariables;
}

const SUPPORTED_FETCH_POLICIES: FetchPolicy[] = [
  'cache-first',
  'network-only',
  'no-cache',
  'standby',
  'cache-and-network',
];

const DEFAULT_FETCH_POLICY: FetchPolicy = 'cache-first';

export function useSuspenseQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData, TVariables> {
  const suspenseCache = useSuspenseCache();
  const hasRunValidations = useRef(false);
  const opts = useDeepMemo(
    () => ({
      ...options,
      query,
      fetchPolicy: options.fetchPolicy || DEFAULT_FETCH_POLICY,
      notifyOnNetworkStatusChange: true,
    }),
    [options, query]
  );
  const client = useApolloClient(opts.client);
  const { variables } = opts;

  if (!hasRunValidations.current) {
    validateOptions(opts);
    hasRunValidations.current = true;
  }

  const [observable] = useState(() => {
    return (
      suspenseCache.getQuery(query) ||
      suspenseCache.registerQuery(query, client.watchQuery(opts))
    );
  });

  const resultRef = useRef<ApolloQueryResult<TData>>();
  const previousOptsRef =
    useRef<SuspenseQueryHookOptions<TData, TVariables>>(opts);

  if (!resultRef.current) {
    resultRef.current = observable.getCurrentResult();
  }

  const result = useSyncExternalStore(
    useCallback(
      (forceUpdate) => {
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

        return () => subscription.unsubscribe();
      },
      [observable]
    ),
    () => resultRef.current!,
    () => resultRef.current!
  );

  if (result.loading) {
    let cacheEntry = suspenseCache.getVariables(observable, variables);

    if (!cacheEntry) {
      const promise = observable.reobserve(opts);
      cacheEntry = suspenseCache.setVariables(
        observable,
        opts.variables,
        promise
      );
    }

    if (!cacheEntry.resolved) {
      throw cacheEntry.promise;
    }
  }

  useEffect(() => {
    if (
      opts.variables !== previousOptsRef.current?.variables ||
      opts.query !== previousOptsRef.current.query
    ) {
      const promise = observable.reobserve(opts);

      suspenseCache.setVariables(observable, opts.variables, promise);
      previousOptsRef.current = opts;
    }
  }, [opts.variables, opts.query]);

  return useMemo(() => {
    return {
      data: result.data,
      variables: observable.variables as TVariables,
    };
  }, [result, observable]);
}

type ValidateFunctionOptions = SuspenseQueryHookOptions & {
  query: DocumentNode | TypedDocumentNode;
};

function validateOptions(options: ValidateFunctionOptions) {
  const { query, fetchPolicy = DEFAULT_FETCH_POLICY } = options;

  verifyDocumentType(query, DocumentType.Query);
  validateFetchPolicy(fetchPolicy);
}

function validateFetchPolicy(
  fetchPolicy: SuspenseQueryHookOptions['fetchPolicy']
) {
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
