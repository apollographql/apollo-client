import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';

import { LazyQueryHookOptions, QueryTuple } from '../types/types';
import { useBaseQuery } from './utils/useBaseQuery';
import { OperationVariables } from '../../core';

export function useLazyQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: LazyQueryHookOptions<TData, TVariables>
) {
  return useBaseQuery<TData, TVariables>(query, options, true) as QueryTuple<
    TData,
    TVariables
  >;
}
