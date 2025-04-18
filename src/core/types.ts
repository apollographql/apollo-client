import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { DocumentNode } from "graphql";
import type { NextNotification, ObservableNotification } from "rxjs";

import type { ApolloCache } from "@apollo/client/cache";
import type { Cache } from "@apollo/client/cache";
import type { FetchResult } from "@apollo/client/link/core";
import type { Unmasked } from "@apollo/client/masking";
import type { IsStrictlyAny } from "@apollo/client/utilities";

import type { Resolver } from "./LocalState.js";
import type { NetworkStatus } from "./networkStatus.js";
import type { ObservableQuery } from "./ObservableQuery.js";
import type { QueryInfo } from "./QueryInfo.js";
import type {
  QueryOptions,
  WatchQueryFetchPolicy,
} from "./watchQueryOptions.js";

export type { TypedDocumentNode } from "@graphql-typed-document-node/core";

export type MethodKeys<T> = {
  [P in keyof T]: T[P] extends Function ? P : never;
}[keyof T];

export interface DefaultContext extends Record<string, any> {}

export type QueryListener = (queryInfo: QueryInfo) => void;

/**
 * Represents an `Error` type, but used throughout Apollo Client to represent
 * errors that may otherwise fail `instanceof` checks if they are cross-realm
 * Error instances (see the [`Error.isError` proposal](https://github.com/tc39/proposal-is-error) for more details).
 *
 * Apollo Client uses several types of errors throughout the client which can be
 * narrowed using `instanceof`:
 * - `CombinedGraphQLErrors` - `errors` returned from a GraphQL result
 * - `CombinedProtocolErrors` - Transport-level errors from multipart subscriptions.
 * - `ServerParseError` - A JSON-parse error when parsing the server response.
 * - `ServerError` - A non-200 server response.
 *
 * @example
 * ```ts
 * import { CombinedGraphQLErrors } from "@apollo/client";
 *
 * try {
 *   await client.query({ query });
 * } catch (error) {
 *   // Use `instanceof` to check for more specific types of errors.
 *   if (error instanceof CombinedGraphQLErrors) {
 *     error.errors.map(graphQLError => console.log(graphQLError.message));
 *   } else {
 *     console.error(errors);
 *   }
 * }
 * ```
 */
export interface ErrorLike {
  message: string;
  name: string;
  stack?: string;
}

export type OnQueryUpdated<TResult> = (
  observableQuery: ObservableQuery<any>,
  diff: Cache.DiffResult<any>,
  lastDiff: Cache.DiffResult<any> | undefined
) => boolean | TResult;

export type RefetchQueryDescriptor = string | DocumentNode;
export type InternalRefetchQueryDescriptor =
  | RefetchQueryDescriptor
  | QueryOptions;

type RefetchQueriesIncludeShorthand = "all" | "active";

export type RefetchQueriesInclude =
  | RefetchQueryDescriptor[]
  | RefetchQueriesIncludeShorthand;

export type InternalRefetchQueriesInclude =
  | InternalRefetchQueryDescriptor[]
  | RefetchQueriesIncludeShorthand;

// Used by ApolloClient["refetchQueries"]
// TODO Improve documentation comments for this public type.
export interface RefetchQueriesOptions<TCache extends ApolloCache, TResult> {
  updateCache?: (cache: TCache) => void;
  // The client.refetchQueries method discourages passing QueryOptions, by
  // restricting the public type of options.include to exclude QueryOptions as
  // an available array element type (see InternalRefetchQueriesInclude for a
  // version of RefetchQueriesInclude that allows legacy QueryOptions objects).
  include?: RefetchQueriesInclude;
  optimistic?: boolean;
  // If no onQueryUpdated function is provided, any queries affected by the
  // updateCache function or included in the options.include array will be
  // refetched by default. Passing null instead of undefined disables this
  // default refetching behavior for affected queries, though included queries
  // will still be refetched.
  onQueryUpdated?: OnQueryUpdated<TResult> | null;
}

// The client.refetchQueries method returns a thenable (PromiseLike) object
// whose result is an array of Promise.resolve'd TResult values, where TResult
// is whatever type the (optional) onQueryUpdated function returns. When no
// onQueryUpdated function is given, TResult defaults to ApolloQueryResult<any>
// (thanks to default type parameters for client.refetchQueries).
export type RefetchQueriesPromiseResults<TResult> =
  // If onQueryUpdated returns any, all bets are off, so the results array must
  // be a generic any[] array, which is much less confusing than the union type
  // we get if we don't check for any. I hoped `any extends TResult` would do
  // the trick here, instead of IsStrictlyAny, but you can see for yourself what
  // fails in the refetchQueries tests if you try making that simplification.
  IsStrictlyAny<TResult> extends true ? any[]
  : // If the onQueryUpdated function passed to client.refetchQueries returns true
  // or false, that means either to refetch the query (true) or to skip the
  // query (false). Since refetching produces an ApolloQueryResult<any>, and
  // skipping produces nothing, the fully-resolved array of all results produced
  // will be an ApolloQueryResult<any>[], when TResult extends boolean.
  TResult extends boolean ? QueryResult<any>[]
  : // If onQueryUpdated returns a PromiseLike<U>, that thenable will be passed as
  // an array element to Promise.all, so we infer/unwrap the array type U here.
  TResult extends PromiseLike<infer U> ? U[]
  : // All other onQueryUpdated results end up in the final Promise.all array as
    // themselves, with their original TResult type. Note that TResult will
    // default to ApolloQueryResult<any> if no onQueryUpdated function is passed
    // to client.refetchQueries.
    TResult[];

// The result of client.refetchQueries is thenable/awaitable, if you just want
// an array of fully resolved results, but you can also access the raw results
// immediately by examining the additional { queries, results } properties of
// the RefetchQueriesResult<TResult> object.
export interface RefetchQueriesResult<TResult>
  extends Promise<RefetchQueriesPromiseResults<TResult>> {
  // An array of ObservableQuery objects corresponding 1:1 to TResult values
  // in the results arrays (both the TResult[] array below, and the results
  // array resolved by the Promise above).
  queries: ObservableQuery<any>[];
  // These are the raw TResult values returned by any onQueryUpdated functions
  // that were invoked by client.refetchQueries.
  results: InternalRefetchQueriesResult<TResult>[];
}

// Used by QueryManager["refetchQueries"]
export interface InternalRefetchQueriesOptions<
  TCache extends ApolloCache,
  TResult,
> extends Omit<RefetchQueriesOptions<TCache, TResult>, "include"> {
  // Just like the refetchQueries option for a mutation, an array of strings,
  // DocumentNode objects, and/or QueryOptions objects, or one of the shorthand
  // strings "all" or "active", to select every (active) query.
  include?: InternalRefetchQueriesInclude;
  // This part of the API is a (useful) implementation detail, but need not be
  // exposed in the public client.refetchQueries API (above).
  removeOptimistic?: string;
}

export type InternalRefetchQueriesResult<TResult> =
  // If onQueryUpdated returns a boolean, that's equivalent to refetching the
  // query when the boolean is true and skipping the query when false, so the
  // internal type of refetched results is Promise<ApolloQueryResult<any>>.
  TResult extends boolean ? Promise<QueryResult<any>>
  : // Otherwise, onQueryUpdated returns whatever it returns. If onQueryUpdated is
    // not provided, TResult defaults to Promise<ApolloQueryResult<any>> (see the
    // generic type parameters of client.refetchQueries).
    TResult;

export type InternalRefetchQueriesMap<TResult> = Map<
  ObservableQuery<any>,
  InternalRefetchQueriesResult<TResult>
>;

export type OperationVariables = Record<string, any>;

export interface ApolloQueryResult<T> {
  data: T | undefined;
  /**
   * The single Error object that is passed to onError and useQuery hooks, and is often thrown during manual `client.query` calls.
   * This will contain both a NetworkError field and any GraphQLErrors.
   * See https://www.apollographql.com/docs/react/data/error-handling/ for more information.
   */
  error?: ErrorLike;
  loading: boolean;
  networkStatus: NetworkStatus;
  /**
   * Describes whether `data` is a complete or partial result. This flag is only
   * set when `returnPartialData` is `true` in query options.
   *
   * @deprecated This field will be removed in a future version of Apollo Client.
   */
  partial: boolean;
}

// This is part of the public API, people write these functions in `updateQueries`.
export type MutationQueryReducer<T> = (
  previousResult: Record<string, any>,
  options: {
    mutationResult: FetchResult<Unmasked<T>>;
    queryName: string | undefined;
    queryVariables: Record<string, any>;
  }
) => Record<string, any>;

export type MutationQueryReducersMap<T = { [key: string]: any }> = {
  [queryName: string]: MutationQueryReducer<T>;
};

/**
 * @deprecated Use `MutationUpdaterFunction` instead.
 */
export type MutationUpdaterFn<T = { [key: string]: any }> = (
  // The MutationUpdaterFn type is broken because it mistakenly uses the same
  // type parameter T for both the cache and the mutationResult. Do not use this
  // type unless you absolutely need it for backwards compatibility.
  cache: ApolloCache,
  mutationResult: FetchResult<T>
) => void;

export type MutationUpdaterFunction<
  TData,
  TVariables,
  TContext,
  TCache extends ApolloCache,
> = (
  cache: TCache,
  result: Omit<FetchResult<Unmasked<TData>>, "context">,
  options: {
    context?: TContext;
    variables?: TVariables;
  }
) => void;
export interface Resolvers {
  [key: string]: {
    [field: string]: Resolver;
  };
}

export interface MutateResult<TData = unknown> {
  /** {@inheritDoc @apollo/client!MutationResultDocumentation#data:member} */
  data: TData | undefined;

  /** {@inheritDoc @apollo/client!MutationResultDocumentation#error:member} */
  error?: ErrorLike;

  /** {@inheritDoc @apollo/client!MutationResultDocumentation#extensions:member} */
  extensions?: Record<string, unknown>;
}

export interface SubscribeResult<TData = unknown> {
  /** {@inheritDoc @apollo/client!MutationResultDocumentation#data:member} */
  data: TData | undefined;

  /** {@inheritDoc @apollo/client!MutationResultDocumentation#error:member} */
  error?: ErrorLike;

  /** {@inheritDoc @apollo/client!MutationResultDocumentation#extensions:member} */
  extensions?: Record<string, unknown>;
}

export interface QueryResult<TData = unknown> {
  /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
  data: TData | undefined;

  /** {@inheritDoc @apollo/client!QueryResultDocumentation#error:member} */
  error?: ErrorLike;
}

export declare namespace QueryNotification {
  interface Meta<TData, TVariables> {
    query: DocumentNode | TypedDocumentNode<TData, TVariables>;
    variables: TVariables | undefined;
  }

  type NewNetworkStatus<TData, TVariables> = NextNotification<{
    networkStatus: NetworkStatus;
  }> &
    Meta<TData, TVariables> & {
      source: "newNetworkStatus";
    };

  type FromNetwork<TData, TVariables> = ObservableNotification<
    ApolloQueryResult<TData>
  > &
    Meta<TData, TVariables> & {
      source: "network";
      fetchPolicy: WatchQueryFetchPolicy;
      reason: NetworkStatus;
    };

  type FromFetchMore<TData, TVariables> = ObservableNotification<
    ApolloQueryResult<any>
  > &
    Meta<TData, TVariables> & {
      source: "fetchMore";
    };

  type FromCache<TData, TVariables> = NextNotification<
    ApolloQueryResult<TData>
  > &
    Meta<TData, TVariables> & {
      source: "cache";
      /** only present if triggered from link */
      fetchPolicy?: WatchQueryFetchPolicy;
      /** only present if triggered from link */
      reason?: NetworkStatus;
    };

  type Value<TData, TVariables> =
    | FromCache<TData, TVariables>
    | FromNetwork<TData, TVariables>
    | FromFetchMore<TData, TVariables>
    | NewNetworkStatus<TData, TVariables>;

  type InternalResult<T, TData, TVariables> = {
    result: T;
  } & QueryNotification.Meta<TData, TVariables>;
}
