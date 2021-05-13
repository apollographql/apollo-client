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

export type OnQueryUpdated<TResult> = (
  observableQuery: ObservableQuery<any>,
  diff: Cache.DiffResult<any>,
  lastDiff: Cache.DiffResult<any> | undefined,
) => boolean | TResult;

export type PromiseResult<T> =
  T extends PromiseLike<infer U> ? U : T;

export type RefetchQueryDescriptor = string | PureQueryOptions;
export type RefetchQueryDescription = RefetchQueryDescriptor[];

// Used by ApolloClient["refetchQueries"]
// TODO Improve documentation comments for this public type.
export interface RefetchQueriesOptions<
  TCache extends ApolloCache<any>,
  TResult,
> {
  updateCache?: (cache: TCache) => void;
  // Although you can pass PureQueryOptions objects in addition to strings in
  // the refetchQueries array for a mutation, the client.refetchQueries method
  // deliberately discourages passing PureQueryOptions, by restricting the
  // public type of the options.include array to string[] (just query names).
  include?: string[];
  optimistic?: boolean;
  // If no onQueryUpdated function is provided, any queries affected by the
  // updateCache function or included in the options.include array will be
  // refetched by default. Passing null instead of undefined disables this
  // default refetching behavior for affected queries, though included queries
  // will still be refetched.
  onQueryUpdated?: OnQueryUpdated<TResult> | null;
}

// Used by QueryManager["refetchQueries"]
export interface InternalRefetchQueriesOptions<
  TCache extends ApolloCache<any>,
  TResult,
> extends Omit<RefetchQueriesOptions<TCache, TResult>, "include"> {
  // Just like the refetchQueries array for a mutation, allowing both strings
  // and PureQueryOptions objects.
  include?: RefetchQueryDescription;
  // This part of the API is a (useful) implementation detail, but need not be
  // exposed in the public client.refetchQueries API (above).
  removeOptimistic?: string;
}

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
