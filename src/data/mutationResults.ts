import { ApolloAction } from '../actions';

import { ApolloExecutionResult } from '../core/types';

// This is part of the public API, people write these functions in `updateQueries`.
export type MutationQueryReducer<T> = (
  previousResult: Record<string, any>,
  options: {
    mutationResult: ApolloExecutionResult<T>;
    queryName: string | null;
    queryVariables: Record<string, any>;
  },
) => Record<string, any>;

export type MutationQueryReducersMap<T = { [key: string]: any }> = {
  [queryName: string]: MutationQueryReducer<T>;
};

export type OperationResultReducer = (
  previousResult: Record<string, any>,
  action: ApolloAction,
  variables: Record<string, any>,
) => Record<string, any>;

export type OperationResultReducerMap = {
  [queryId: string]: OperationResultReducer;
};
