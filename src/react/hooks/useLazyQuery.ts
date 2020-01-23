import { DocumentNode } from 'graphql';

import { LazyQueryHookOptions, QueryTuple } from '../types/types';
import { useBaseQuery } from './utils/useBaseQuery';
import { OperationVariables } from '../../core/types';

export function useLazyQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode,
  options?: LazyQueryHookOptions<TData, TVariables>
) {
  return useBaseQuery<TData, TVariables>(query, options, true) as QueryTuple<
    TData,
    TVariables
  >;
}
