import { DocumentNode, GraphQLError } from 'graphql';

import { FetchResult } from '../link/core';
import { ApolloError } from '../errors';
import { QueryInfo } from './QueryInfo';
import { NetworkStatus } from './networkStatus';
import { Resolver } from './LocalState';

export { TypedDocumentNode } from '@graphql-typed-document-node/core';

export type QueryListener = (queryInfo: QueryInfo) => void;

export type OperationVariables = Record<string, any>;

export type PureQueryOptions = {
  query: DocumentNode;
  variables?: { [key: string]: any };
  context?: any;
};

export type ApolloQueryResult<T> = {
  data: T;
  errors?: ReadonlyArray<GraphQLError>;
  error?: ApolloError;
  loading: boolean;
  networkStatus: NetworkStatus;
  // If result.data was read from the cache with missing fields,
  // result.partial will be true. Otherwise, result.partial will be falsy
  // (usually because the property is absent from the result object).
  partial?: boolean;
};

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
    [ field: string ]: Resolver;
  };
}
