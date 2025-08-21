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
import type { QueryRef } from "@apollo/client/react";
import {
  assertWrappedQueryRef,
  getWrappedPromise,
  unwrapQueryRef,
  updateWrappedQueryRef,
} from "@apollo/client/react/internal";
import type { DocumentationTypes as UtilityDocumentationTypes } from "@apollo/client/utilities/internal";

import { __use, wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

export declare namespace useReadQuery {
  export namespace Base {
    export interface Result<TData = unknown> {
      /**
       * {@inheritDoc @apollo/client!QueryResultDocumentation#error:member}
       *
       * This property can be ignored when using the default `errorPolicy` or an
       * `errorPolicy` of `none`. The hook will throw the error instead of setting
       * this property.
       */
      error: ErrorLike | undefined;
      /** {@inheritDoc @apollo/client!QueryResultDocumentation#networkStatus:member} */
      networkStatus: NetworkStatus;
    }
  }
  export type Result<
    TData = unknown,
    TStates extends
      DataState<TData>["dataState"] = DataState<TData>["dataState"],
  > = Base.Result<TData> & GetDataState<MaybeMasked<TData>, TStates>;

  export namespace DocumentationTypes {
    namespace useReadQuery {
      export interface Result<TData = unknown>
        extends Base.Result<TData>,
          UtilityDocumentationTypes.DataState<TData> {}
    }

    /** {@inheritDoc @apollo/client/react!useReadQuery:function(1)} */
    export function useReadQuery<TData>(
      queryRef: QueryRef<TData>
    ): useReadQuery.Result<TData>;
  }
}

/**
 * For a detailed explanation of `useReadQuery`, see the [fetching with Suspense reference](https://www.apollographql.com/docs/react/data/suspense#avoiding-request-waterfalls).
 *
 * @param queryRef - The `QueryRef` that was generated via `useBackgroundQuery`.
 * @returns An object containing the query result data, error, and network status.
 *
 * @example
 *
 * ```jsx
 * import { Suspense } from "react";
 * import { useBackgroundQuery, useReadQuery } from "@apollo/client";
 *
 * function Parent() {
 *   const [queryRef] = useBackgroundQuery(query);
 *
 *   return (
 *     <Suspense fallback={<div>Loading...</div>}>
 *       <Child queryRef={queryRef} />
 *     </Suspense>
 *   );
 * }
 *
 * function Child({ queryRef }) {
 *   const { data } = useReadQuery(queryRef);
 *
 *   return <div>{data.name}</div>;
 * }
 * ```
 */
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
