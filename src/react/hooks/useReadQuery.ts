import * as React from "rehackt";
import {
  getWrappedPromise,
  unwrapQueryRef,
  updateWrappedQueryRef,
} from "../internal/index.js";
import type {
  InternalQueryReference,
  QueryReference,
} from "../internal/index.js";
import { __use, wrapHook } from "./internal/index.js";
import { toApolloError } from "./useSuspenseQuery.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
import type { ApolloError } from "../../errors/index.js";
import type { NetworkStatus } from "../../core/index.js";
import { useApolloClient } from "./useApolloClient.js";

export interface UseReadQueryResult<TData = unknown> {
  /**
   * An object containing the result of your GraphQL query after it completes.
   *
   * This value might be `undefined` if a query results in one or more errors
   * (depending on the query's `errorPolicy`).
   */
  data: TData;
  /**
   * If the query produces one or more errors, this object contains either an
   * array of `graphQLErrors` or a single `networkError`. Otherwise, this value
   * is `undefined`.
   *
   * This property can be ignored when using the default `errorPolicy` or an
   * `errorPolicy` of `none`. The hook will throw the error instead of setting
   * this property.
   */
  error: ApolloError | undefined;
  /**
   * A number indicating the current network state of the query's associated
   * request. {@link https://github.com/apollographql/apollo-client/blob/d96f4578f89b933c281bb775a39503f6cdb59ee8/src/core/networkStatus.ts#L4 | See possible values}.
   */
  networkStatus: NetworkStatus;
}

export function useReadQuery<TData>(
  queryRef: QueryReference<TData>
): UseReadQueryResult<TData> {
  const unwrapped = unwrapQueryRef(
    queryRef
  ) satisfies InternalQueryReference<TData> as /*
    by all rules of this codebase, this should never be undefined
    but if `queryRef` is a transported object, it cannot have a
    `QUERY_REFERENCE_SYMBOL` symbol property, so the call above
    will return `undefined` and we want that represented in the type
    */ InternalQueryReference<TData> | undefined;

  return wrapHook(
    "useReadQuery",
    _useReadQuery,
    unwrapped ?
      unwrapped["observable"]
      // in the case of a "transported" queryRef object, we need to use the
      // client that's available to us at the current position in the React tree
      // that ApolloClient will then have the job to recreate a real queryRef from
      // the transported object
    : useApolloClient()
  )(queryRef);
}

function _useReadQuery<TData>(
  queryRef: QueryReference<TData>
): UseReadQueryResult<TData> {
  const internalQueryRef = React.useMemo(
    () => unwrapQueryRef(queryRef),
    [queryRef]
  );

  const getPromise = React.useCallback(
    () => getWrappedPromise(queryRef),
    [queryRef]
  );

  if (internalQueryRef.disposed) {
    internalQueryRef.reinitialize();
    updateWrappedQueryRef(queryRef, internalQueryRef.promise);
  }

  React.useEffect(() => internalQueryRef.retain(), [internalQueryRef]);

  const promise = useSyncExternalStore(
    React.useCallback(
      (forceUpdate) => {
        return internalQueryRef.listen((promise) => {
          updateWrappedQueryRef(queryRef, promise);
          forceUpdate();
        });
      },
      [internalQueryRef]
    ),
    getPromise,
    getPromise
  );

  const result = __use(promise);

  return React.useMemo(() => {
    return {
      data: result.data,
      networkStatus: result.networkStatus,
      error: toApolloError(result),
    };
  }, [result]);
}
