import { DocumentNode, GraphQLError } from 'graphql';

import { ApolloCache } from '../cache';
import { FetchResult } from '../link/core';
import { ApolloError } from '../errors';
import { QueryInfo } from './QueryInfo';
import { NetworkStatus } from './networkStatus';
import { Resolver } from './LocalState';
import { ObservableQuery } from './ObservableQuery';
import { Cache } from '../cache';

export { TypedDocumentNode } from '@graphql-typed-document-node/core';

export type DefaultContext = Record<string, any>;

export type QueryListener = (queryInfo: QueryInfo) => void;

export type OnQueryUpdated<TData> = (
  observableQuery: ObservableQuery,
  diff: Cache.DiffResult<TData>,
  lastDiff: Cache.DiffResult<TData> | undefined,
) => boolean | Promise<ApolloQueryResult<TData>>;

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

export type MutationUpdaterFunction<
  TData,
  TVariables,
  TContext,
  TCache extends ApolloCache<any>
> = (
  cache: TCache,
  result: Omit<FetchResult<TData>, 'context'>,
  options: {
    context?: TContext,
    variables?: TVariables,
  },
) => void;
export interface Resolvers {
  [key: string]: {
    [ field: string ]: Resolver;
  };
}
