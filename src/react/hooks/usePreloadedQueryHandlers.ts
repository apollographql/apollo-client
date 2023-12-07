import * as React from "rehackt";
import {
  getWrappedPromise,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "../cache/QueryReference.js";
import type { QueryReference } from "../cache/QueryReference.js";
import type { OperationVariables } from "../../core/types.js";
import type { RefetchFunction, FetchMoreFunction } from "./useSuspenseQuery.js";
import type { FetchMoreQueryOptions } from "../../core/watchQueryOptions.js";

export interface UsePreloadedQueryHandlersResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  refetch: RefetchFunction<TData, TVariables>;
  fetchMore: FetchMoreFunction<TData, TVariables>;
}

export function usePreloadedQueryHandlers<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  queryRef: QueryReference<TData>
): UsePreloadedQueryHandlersResult<TData, TVariables> {
  const [wrappedQueryRef, setWrappedQueryRef] = React.useState(queryRef);
  const [internalQueryRef] = unwrapQueryRef(queryRef);

  // To ensure we can support React transitions, this hook needs to manage the
  // queryRef state and apply React's state value immediately to the existing
  // queryRef since this hook doesn't return the queryRef directly
  updateWrappedQueryRef(queryRef, getWrappedPromise(wrappedQueryRef));

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (variables) => {
      const promise = internalQueryRef.refetch(variables);

      setWrappedQueryRef(wrapQueryRef(internalQueryRef));

      return promise;
    },
    [internalQueryRef]
  );

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      const promise = internalQueryRef.fetchMore(
        options as FetchMoreQueryOptions<any, any>
      );

      setWrappedQueryRef(wrapQueryRef(internalQueryRef));

      return promise;
    },
    [internalQueryRef]
  );

  return { refetch, fetchMore };
}
