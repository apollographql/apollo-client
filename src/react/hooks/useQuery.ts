import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';

import { QueryHookOptions, QueryResult } from '../types/types';
import { useBaseQuery } from './utils/useBaseQuery';
import { OperationVariables } from '../../core';

export function useQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: QueryHookOptions<TData, TVariables>
) {
  return useBaseQuery<TData, TVariables>(query, options, false) as QueryResult<
    TData,
    TVariables
  >;
}
