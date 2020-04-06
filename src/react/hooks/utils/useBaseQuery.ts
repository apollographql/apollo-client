import { DocumentNode } from 'graphql';

import {
  QueryHookOptions,
  QueryDataOptions,
  QueryTuple,
  QueryResult,
} from '../../types/types';
import { QueryData } from '../../data/QueryData';
import { useDeepMemo } from './useDeepMemo';
import { OperationVariables } from '../../../core/types';
import { getApolloContext } from '../../context/ApolloContext';
import { requireReactLazily } from '../../react';

export function useBaseQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode,
  options?: QueryHookOptions<TData, TVariables>,
  lazy = false
) {
  const React = requireReactLazily();
  const { useContext, useEffect, useReducer, useRef } = React;
  const context = useContext(getApolloContext());
  const [tick, forceUpdate] = useReducer(x => x + 1, 0);
  const updatedOptions = options ? { ...options, query } : { query };

  const queryDataRef = useRef<QueryData<TData, TVariables>>();

  if (!queryDataRef.current) {
    queryDataRef.current = new QueryData<TData, TVariables>({
      options: updatedOptions as QueryDataOptions<TData, TVariables>,
      context,
      forceUpdate
    });
  }

  const queryData = queryDataRef.current;
  queryData.setOptions(updatedOptions);
  queryData.context = context;

  // `onError` and `onCompleted` callback functions will not always have a
  // stable identity, so we'll exclude them from the memoization key to
  // prevent `afterExecute` from being triggered un-necessarily.
  const memo = {
    options: {
      ...updatedOptions,
      onError: undefined,
      onCompleted: undefined
    } as QueryHookOptions<TData, TVariables>,
    context,
    tick
  };

  const result = useDeepMemo(
    () => (lazy ? queryData.executeLazy() : queryData.execute()),
    memo
  );

  const queryResult = lazy
    ? (result as QueryTuple<TData, TVariables>)[1]
    : (result as QueryResult<TData, TVariables>);

  useEffect(() => queryData.afterExecute({ queryResult, lazy }), [
    queryResult.loading,
    queryResult.networkStatus,
    queryResult.error,
    queryResult.data
  ]);

  useEffect(() => {
    return () => queryData.cleanup();
  }, []);

  return result;
}
