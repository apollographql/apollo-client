import type { DocumentNode, FormattedExecutionResult } from "graphql";
import type {
  NextNotification,
  Observable,
  ObservableNotification,
} from "rxjs";

import type { ApolloCache } from "@apollo/client/cache";
import type { Cache } from "@apollo/client/cache";
import type { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import type { Unmasked } from "@apollo/client/masking";
import type { DeepPartial, HKT } from "@apollo/client/utilities";
import type {
  ApplyHKTImplementationWithDefault,
  IsAny,
} from "@apollo/client/utilities/internal";

import type { ApolloClient } from "./ApolloClient.js";
import type { ObservableQuery } from "./ObservableQuery.js";

export type { TypedDocumentNode } from "@graphql-typed-document-node/core";

export interface TypeOverrides {}

declare namespace OverridableTypes {
  export interface Defaults {
    Complete: Complete;
    Streaming: Streaming;
    Partial: Partial;
  }

  interface Complete extends HKT {
    arg1: unknown; // TData
    return: this["arg1"];
  }

  interface Streaming extends HKT {
    arg1: unknown; // TData
    return: this["arg1"];
  }

  interface Partial extends HKT {
    arg1: unknown; // TData
    return: DeepPartial<this["arg1"]>;
  }
}

export declare namespace DataValue {
  /**
   * Returns a representation of `TData` in it's "complete" state.
   *
   * @defaultValue `TData` if no overrides are provided.
   *
   * @example
   * You can override this type globally - this example shows how to override it
   * with `DeepPartial<TData>`:
   *
   * ```ts
   * import { HKT, DeepPartial } from "@apollo/client/utilities";
   *
   * type CompleteOverride<TData> =
   *   TData extends { _complete?: infer _Complete } ? _Complete : TData;
   *
   * interface CompleteOverrideHKT extends HKT {
   *   return: CompleteOverride<this["arg1"]>;
   * }
   *
   * declare module "@apollo/client" {
   *   export interface TypeOverrides {
   *     Complete: CompleteOverrideHKT;
   *   }
   * }
   * ```
   */
  export type Complete<TData> = ApplyHKTImplementationWithDefault<
    TypeOverrides,
    "Complete",
    OverridableTypes.Defaults,
    TData
  >;

  /**
   * Returns a representation of `TData` while it is streaming.
   *
   * @defaultValue `TData` if no overrides are provided.
   *
   * @example
   * You can override this type globally - this example shows how to override it
   * with `DeepPartial<TData>`:
   *
   * ```ts
   * import { HKT, DeepPartial } from "@apollo/client/utilities";
   *
   * type StreamingOverride<TData> = DeepPartial<TData>;
   *
   * interface StreamingOverrideHKT extends HKT {
   *   return: StreamingOverride<this["arg1"]>;
   * }
   *
   * declare module "@apollo/client" {
   *   export interface TypeOverrides {
   *     Streaming: StreamingOverrideHKT;
   *   }
   * }
   * ```
   */
  export type Streaming<TData> = ApplyHKTImplementationWithDefault<
    TypeOverrides,
    "Streaming",
    OverridableTypes.Defaults,
    TData
  >;

  /**
   * Returns a representation of `TData` while it is partial.
   *
   * @defaultValue `DeepPartial<TData>` if no overrides are provided.
   *
   * @example
   * You can override this type globally - this example shows how to override it
   * with `DeepPartial<TData>`:
   *
   * ```ts
   * import { HKT, DeepPartial } from "@apollo/client/utilities";
   *
   * type PartialOverride<TData> = DeepPartial<Complete<TData>>;
   *
   * interface PartialOverrideHKT extends HKT {
   *   return: PartialOverride<this["arg1"]>;
   * }
   *
   * declare module "@apollo/client" {
   *   export interface TypeOverrides {
   *     Partial: PartialOverrideHKT;
   *   }
   * }
   * ```
   */
  export type Partial<TData> = ApplyHKTImplementationWithDefault<
    TypeOverrides,
    "Partial",
    OverridableTypes.Defaults,
    TData
  >;
}

export interface DefaultContext extends Record<string, any> {
  /**
   * Indicates whether `queryDeduplication` was enabled for the request.
   */
  queryDeduplication?: boolean;
  clientAwareness?: ClientAwarenessLink.ClientAwarenessOptions;
}

/**
 * Represents an `Error` type, but used throughout Apollo Client to represent
 * errors that may otherwise fail `instanceof` checks if they are cross-realm
 * Error instances (see the [`Error.isError` proposal](https://github.com/tc39/proposal-is-error) for more details).
 *
 * Apollo Client uses several types of errors throughout the client which can be
 * narrowed using `instanceof`:
 *
 * - `CombinedGraphQLErrors` - `errors` returned from a GraphQL result
 * - `CombinedProtocolErrors` - Transport-level errors from multipart subscriptions.
 * - `ServerParseError` - A JSON-parse error when parsing the server response.
 * - `ServerError` - A non-200 server response.
 *
 * @example
 *
 * ```ts
 * import { CombinedGraphQLErrors } from "@apollo/client";
 *
 * try {
 *   await client.query({ query });
 * } catch (error) {
 *   // Use `instanceof` to check for more specific types of errors.
 *   if (error instanceof CombinedGraphQLErrors) {
 *     error.errors.map((graphQLError) => console.log(graphQLError.message));
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
  | ApolloClient.QueryOptions;

type RefetchQueriesIncludeShorthand = "all" | "active";

export type RefetchQueriesInclude =
  | RefetchQueryDescriptor[]
  | RefetchQueriesIncludeShorthand;

export type InternalRefetchQueriesInclude =
  | InternalRefetchQueryDescriptor[]
  | RefetchQueriesIncludeShorthand;

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
  IsAny<TResult> extends true ? any[]
  : // If the onQueryUpdated function passed to client.refetchQueries returns true
  // or false, that means either to refetch the query (true) or to skip the
  // query (false). Since refetching produces an ApolloQueryResult<any>, and
  // skipping produces nothing, the fully-resolved array of all results produced
  // will be an ApolloQueryResult<any>[], when TResult extends boolean.
  TResult extends boolean ? ApolloClient.QueryResult<any>[]
  : // If onQueryUpdated returns a PromiseLike<U>, that thenable will be passed as
  // an array element to Promise.all, so we infer/unwrap the array type U here.
  TResult extends PromiseLike<infer U> ? U[]
  : // All other onQueryUpdated results end up in the final Promise.all array as
    // themselves, with their original TResult type. Note that TResult will
    // default to ApolloQueryResult<any> if no onQueryUpdated function is passed
    // to client.refetchQueries.
    TResult[];

// Used by QueryManager["refetchQueries"]
export interface InternalRefetchQueriesOptions<
  TCache extends ApolloCache,
  TResult,
> extends Omit<ApolloClient.RefetchQueriesOptions<TCache, TResult>, "include"> {
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
  TResult extends boolean ? Promise<ApolloClient.QueryResult<any>>
  : // Otherwise, onQueryUpdated returns whatever it returns. If onQueryUpdated is
    // not provided, TResult defaults to Promise<ApolloQueryResult<any>> (see the
    // generic type parameters of client.refetchQueries).
    TResult;

export type InternalRefetchQueriesMap<TResult> = Map<
  ObservableQuery<any>,
  InternalRefetchQueriesResult<TResult>
>;

export type OperationVariables = Record<string, any>;

export type DataState<TData> =
  | {
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
      data: DataValue.Complete<TData>;
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#dataState:member} */
      dataState: "complete";
    }
  | {
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
      data: DataValue.Streaming<TData>;
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#dataState:member} */
      dataState: "streaming";
    }
  | {
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
      data: DataValue.Partial<TData>;
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#dataState:member} */
      dataState: "partial";
    }
  | {
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
      data: undefined;
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#dataState:member} */
      dataState: "empty";
    };

export type GetDataState<
  TData,
  TState extends DataState<TData>["dataState"],
> = Extract<DataState<TData>, { dataState: TState }>;

/**
 * Represents a result that might be complete or still streaming and
 * has been normalized into a plain GraphQL result. When the result is
 * still `streaming`, some fields might not yet be available.
 */
export type NormalizedExecutionResult<
  TData = Record<string, unknown>,
  TExtensions = Record<string, unknown>,
> = Omit<FormattedExecutionResult<TData, TExtensions>, "data"> &
  GetDataState<TData, "streaming" | "complete">;

// This is part of the public API, people write these functions in `updateQueries`.
export type MutationQueryReducer<T> = (
  previousResult: Record<string, any>,
  options: {
    mutationResult: NormalizedExecutionResult<Unmasked<T>>;
    queryName: string | undefined;
    queryVariables: Record<string, any>;
  }
) => Record<string, any>;

export type MutationQueryReducersMap<T = { [key: string]: any }> = {
  [queryName: string]: MutationQueryReducer<T>;
};

export type MutationUpdaterFunction<
  TData,
  TVariables extends OperationVariables,
  TCache extends ApolloCache,
> = (
  cache: TCache,
  result: FormattedExecutionResult<Unmasked<TData>>,
  options: {
    context?: DefaultContext;
    variables?: TVariables;
  }
) => void;

export declare namespace QueryNotification {
  type NewNetworkStatus = NextNotification<{
    resetError?: boolean;
  }> & {
    source: "newNetworkStatus";
  };

  type SetResult<TData> = NextNotification<ObservableQuery.Result<TData>> & {
    source: "setResult";
  };

  type FromNetwork<TData> = ObservableNotification<
    ObservableQuery.Result<TData>
  > & {
    source: "network";
  };

  type FromCache<TData> = NextNotification<ObservableQuery.Result<TData>> & {
    source: "cache";
  };

  type Value<TData> =
    | FromCache<TData>
    | FromNetwork<TData>
    | NewNetworkStatus
    | SetResult<TData>;
}

/** Observable created by initiating a subscription operation. */
export interface SubscriptionObservable<T> extends Observable<T> {
  /**
   * Used to restart the connection to the link chain. Calling this on a
   * deduplicated subscription will restart the connection for all observables
   * that share the request.
   *
   * @example
   *
   * ```ts
   * const observable = client.subscribe({ query: subscription });
   * observable.subscribe((value) => {
   *   // ...
   * });
   *
   * observable.restart();
   * ```
   */
  restart: () => void;
}
