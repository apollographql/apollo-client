import { useRef, useMemo, useState, DependencyList } from 'react';
import { equal } from '@wry/equality';
import {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode
} from "../../core";
import { useApolloClient } from './useApolloClient';
import { DocumentType, verifyDocumentType } from '../parser';
import { SuspenseQueryHookOptions } from "../types/types";
import { useSuspenseCache } from './useSuspenseCache';

export interface UseSuspenseQueryResult<
  TData = any,
  TVariables = OperationVariables
> {
  data: TData;
  variables: TVariables;
}

const DEFAULT_OPTIONS: Partial<SuspenseQueryHookOptions> = {
  suspensePolicy: 'always'
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
  const cacheEntry = suspenseCache.get(query, opts.variables);

  const [observable] = useState(() => {
    return cacheEntry?.observable || client.watchQuery({ ...opts, query });
  });

  if (!hasVerifiedDocument.current) {
    verifyDocumentType(query, DocumentType.Query);
    hasVerifiedDocument.current = true;
  }

  // We have never run this query before so kick it off and suspend
  if (!cacheEntry) {
    const promise = observable.reobserve(opts);

    suspenseCache.set(query, opts.variables, observable, promise);

    throw promise;
  }

  const result = observable.getCurrentResult();

  return useMemo(() => {
    return {
      data: result.data,
      variables: observable!.variables as TVariables
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
