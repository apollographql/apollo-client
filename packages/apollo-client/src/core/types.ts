import { DocumentNode, ExecutionResult, GraphQLError } from 'graphql';
import { QueryStoreValue } from '../data/queries';
import { NetworkStatus } from './networkStatus';
import { FetchResult } from 'apollo-link';

export type QueryListener = (
  queryStoreValue: QueryStoreValue,
  newData?: any,
) => void;

export type OperationVariables = { [key: string]: any };

export type PureQueryOptions = {
  query: DocumentNode;
  variables?: { [key: string]: any };
};

export type ApolloQueryResult<T> = {
  data: T;
  errors?: GraphQLError[];
  loading: boolean;
  networkStatus: NetworkStatus;
  stale: boolean;
};

export enum FetchType {
  normal = 1,
  refetch = 2,
  poll = 3,
}

// This is part of the public API, people write these functions in `updateQueries`.
export type MutationQueryReducer<T> = (
  previousResult: Record<string, any>,
  options: {
    mutationResult: FetchResult<T>;
    queryName: string | undefined;
    queryVariables: Record<string, any>;
  },
) => Record<string, any>;

export type MutationQueryReducersMap<T = { [key: string]: any }> = {
  [queryName: string]: MutationQueryReducer<T>;
};

/**
 * Define a new type for patches that are sent as a result of using defer.
 * Its is basically the same as ExecutionResult, except that it has a "path"
 * field that keeps track of the where the patch is to be merged with the
 * original result.
 */
export interface ExecutionPatchResult {
  data?: { [key: string]: any };
  errors?: GraphQLError[];
  path: (string | number)[];
}

export function isPatch(
  data: ExecutionResult | ExecutionPatchResult,
): data is ExecutionPatchResult {
  return (data as ExecutionPatchResult).path !== undefined;
}
