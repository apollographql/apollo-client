import { FetchResult } from 'apollo-link';
import { DocumentNode, GraphQLError } from 'graphql';

import { QueryStoreValue } from '../data/queries';
import { NetworkStatus } from './networkStatus';

export type QueryListener = (
  queryStoreValue: QueryStoreValue,
  newData?: any,
  forceResolvers?: boolean,
) => void;

export type OperationVariables = { [key: string]: any };

export type PureQueryOptions = {
  query: DocumentNode;
  variables?: { [key: string]: any };
  context?: any;
};

export type ApolloQueryResult<T> = {
  data: T;
  errors?: ReadonlyArray<GraphQLError>;
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

export interface Resolvers {
  [key: string]: {
    [field: string]: (
      rootValue?: any,
      args?: any,
      context?: any,
      info?: any,
    ) => any;
  };
}
