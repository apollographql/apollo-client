import { DocumentNode } from 'graphql';

import { QueryHookOptions, QueryResult } from '../types/types';
import { useBaseQuery } from './utils/useBaseQuery';
import { OperationVariables } from '../../core';

export function useQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode,
  options?: QueryHookOptions<TData, TVariables>
) {
  return useBaseQuery<TData, TVariables>(query, options, false) as QueryResult<
    TData,
    TVariables
  >;
}
