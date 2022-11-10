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

export interface UseSuspenseQueryResult<
  TData = any,
  TVariables = OperationVariables
> {
  data: TData;
  variables: TVariables;
}

export function useSuspenseQuery_experimental<
  TData = any,
  TVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData, TVariables> {
  const suspenseCache = useSuspenseCache();
  const hasVerifiedDocument = useRef(false);
  const opts = useDeepMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);
  const client = useApolloClient(opts.client);
  const firstRun = !suspenseCache.getQuery(query);
  const { variables, suspensePolicy } = opts;

  if (!hasVerifiedDocument.current) {
    verifyDocumentType(query, DocumentType.Query);
    hasVerifiedDocument.current = true;
  }

  const [observable] = useState(() => {
    return suspenseCache.getQuery(query) ||
      suspenseCache.registerQuery(query, client.watchQuery({ ...opts, query }));
  });

  const lastResult = useRef(observable.getCurrentResult());
  const lastOpts = useRef(opts);
  const cacheEntry = suspenseCache.getVariables(observable, variables);

  // Always suspend on the first run
  if (firstRun) {
    const promise = observable.reobserve(opts);

    suspenseCache.setVariables(observable, variables, promise);

    throw promise;
  } else if (!cacheEntry && suspensePolicy === 'always') {
    const promise = observable.reobserve(opts);

    suspenseCache.setVariables(observable, variables, promise);

    throw promise;
  }

  const result = useSyncExternalStore(
    useCallback((forceUpdate) => {
      const subscription = observable.subscribe(() => {
        const previousResult = lastResult.current;
        const result = observable.getCurrentResult();

        if (
          previousResult &&
          previousResult.loading === result.loading &&
          previousResult.networkStatus === result.networkStatus &&
          equal(previousResult.data, result.data)
        ) {
          return
        }

        lastResult.current = result;
        forceUpdate();
      })

      return () => subscription.unsubscribe();
    }, [observable]),
    () => lastResult.current,
    () => lastResult.current,
  )

  useEffect(() => {
    if (opts !== lastOpts.current) {
      observable.reobserve(opts);
    }
  }, [opts, lastOpts.current]);

  useEffect(() => {
    lastOpts.current = opts;
  }, [opts])

  return useMemo(() => {
    return {
      data: result.data,
      variables: observable.variables as TVariables
    };
  }, [result, observable]);
}

function useDeepMemo<TValue>(memoFn: () => TValue, deps: DependencyList) {
  const ref = useRef<{ deps: DependencyList, value: TValue }>();

  if (!ref.current || !equal(ref.current.deps, deps)) {
    ref.current = { value: memoFn(), deps };
  }

  return ref.current.value;
}
