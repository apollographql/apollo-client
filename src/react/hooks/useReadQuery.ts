import * as React from "rehackt";
import {
  assertWrappedQueryRef,
  getWrappedPromise,
  unwrapQueryRef,
  updateWrappedQueryRef,
} from "../internal/index.js";
import type { QueryRef } from "../internal/index.js";
import { __use, wrapHook } from "./internal/index.js";
import { toApolloError } from "./useSuspenseQuery.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
import type { ApolloError } from "../../errors/index.js";
import type {
  ApolloClient,
  NetworkStatus,
  ObservableQuery,
} from "../../core/index.js";
import { useApolloClient } from "./useApolloClient.js";
import type { MaybeMasked } from "../../masking/index.js";

export interface UseReadQueryResult<TData = unknown> {
  /**
   * An object containing the result of your GraphQL query after it completes.
   *
   * This value might be `undefined` if a query results in one or more errors
   * (depending on the query's `errorPolicy`).
   */
  data: MaybeMasked<TData>;
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
  queryRef: QueryRef<TData>
): UseReadQueryResult<TData> {
  const unwrapped = unwrapQueryRef(queryRef);
  const clientOrObsQuery = useApolloClient(
    unwrapped ?
      // passing an `ObservableQuery` is not supported by the types, but it will
      // return any truthy value that is passed in as an override so we cast the result
      (unwrapped["observable"] as any)
    : undefined
  ) as ApolloClient<any> | ObservableQuery<TData>;

  return wrapHook(
    "useReadQuery",
    // eslint-disable-next-line react-compiler/react-compiler
    useReadQuery_,
    clientOrObsQuery
  )(queryRef);
}

function useReadQuery_<TData>(
  queryRef: QueryRef<TData>
): UseReadQueryResult<TData> {
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
      data: result.data!,
      networkStatus: result.networkStatus,
      error: toApolloError(result),
    };
  }, [result]);
}
