import { DocumentNode } from 'graphql';
import { QueryStoreValue } from '../data/queries';
import { NetworkStatus } from './networkStatus';
import { FetchResult } from 'apollo-link-core';

export type QueryListener = (
  queryStoreValue: QueryStoreValue,
  newData?: any,
) => void;

export type PureQueryOptions = {
  query: DocumentNode;
  variables?: { [key: string]: any };
};

export type ApolloQueryResult<T> = {
  data: T;
  loading: boolean;
  networkStatus: NetworkStatus;
  stale: boolean;

  // This type is different from the ExecutionResult type because it doesn't include errors.
  // Those are thrown via the standard promise/observer catch mechanism.
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
