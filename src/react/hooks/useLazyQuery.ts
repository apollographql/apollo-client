import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useCallback, useState } from 'react';

import {
  LazyQueryHookOptions,
  LazyQueryResult,
  QueryLazyOptions,
  QueryTuple,
} from '../types/types';
import { useQuery } from './useQuery';
import { OperationVariables } from '../../core';

export function useLazyQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: LazyQueryHookOptions<TData, TVariables>
): QueryTuple<TData, TVariables> {
  const [execution, setExecution] = useState<
    { called: boolean, lazyOptions?: QueryLazyOptions<TVariables> }
  >({
    called: false,
  });

  const execute = useCallback<
    QueryTuple<TData, TVariables>[0]
  >((lazyOptions?: QueryLazyOptions<TVariables>) => {
    setExecution((execution) => {
      if (execution.called) {
        result && result.refetch(execution.lazyOptions);
      }

      return { called: true, lazyOptions };
    });
  }, []);

  let result = useQuery<TData, TVariables>(query, {
    ...options,
    ...execution.lazyOptions,
    // We don’t set skip to execution.called, because we need useQuery to call
    // addQueryPromise, so that ssr calls waits for execute to be called.
    fetchPolicy: execution.called ? options?.fetchPolicy : 'standby',
    skip: undefined,
  });

  if (!execution.called) {
    result = {
      ...result,
      loading: false,
      data: void 0 as unknown as TData,
      error: void 0,
      // TODO: fix the type of result
      called: false as any,
    };
  }

  // TODO: fix the type of result
  return [execute, result as LazyQueryResult<TData, TVariables>];
}
