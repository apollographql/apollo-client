import * as React from "react";

import type {
  ApolloClient,
  DataState,
  ErrorLike,
  GetDataState,
  NetworkStatus,
  ObservableQuery,
} from "@apollo/client";
import type { MaybeMasked } from "@apollo/client/masking";
import type { QueryRef } from "@apollo/client/react/internal";
import {
  assertWrappedQueryRef,
  getWrappedPromise,
  unwrapQueryRef,
  updateWrappedQueryRef,
} from "@apollo/client/react/internal";

import { __use, wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

export declare namespace useReadQuery {
  export type Result<
    TData = unknown,
    TStates extends
      DataState<TData>["dataState"] = DataState<TData>["dataState"],
  > = {
    /**
     * If the query produces one or more errors, this object contains either an
     * array of `graphQLErrors` or a single `networkError`. Otherwise, this value
     * is `undefined`.
     *
     * This property can be ignored when using the default `errorPolicy` or an
     * `errorPolicy` of `none`. The hook will throw the error instead of setting
     * this property.
     */
    error: ErrorLike | undefined;
    /**
     * A number indicating the current network state of the query's associated
     * request. {@link https://github.com/apollographql/apollo-client/blob/d96f4578f89b933c281bb775a39503f6cdb59ee8/src/core/networkStatus.ts#L4 | See possible values}.
     */
    networkStatus: NetworkStatus;
  } & GetDataState<MaybeMasked<TData>, TStates>;
}

export function useReadQuery<
  TData,
  TStates extends DataState<TData>["dataState"],
>(
  queryRef: QueryRef<TData, any, TStates>
): useReadQuery.Result<TData, TStates> {
  "use no memo";
  const unwrapped = unwrapQueryRef(queryRef);
  const clientOrObsQuery = useApolloClient(
    unwrapped ?
      // passing an `ObservableQuery` is not supported by the types, but it will
      // return any truthy value that is passed in as an override so we cast the result
      (unwrapped["observable"] as any)
    : undefined
  ) as ApolloClient | ObservableQuery<TData>;

  return wrapHook(
    "useReadQuery",
    // eslint-disable-next-line react-compiler/react-compiler
    useReadQuery_,
    clientOrObsQuery
  )(queryRef);
}

function useReadQuery_<TData, TStates extends DataState<TData>["dataState"]>(
  queryRef: QueryRef<TData, any, TStates>
): useReadQuery.Result<TData, TStates> {
  assertWrappedQueryRef(queryRef);
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
      [internalQueryRef, queryRef]
    ),
    getPromise,
    getPromise
  );

  const result = __use(promise);

  return React.useMemo(() => {
    return {
      data: result.data,
      dataState: result.dataState,
      networkStatus: result.networkStatus,
      error: result.error,
    } as useReadQuery.Result<TData, TStates>;
  }, [result]);
}
