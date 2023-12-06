import * as React from "rehackt";
import {
  unwrapQueryRef,
  updateWrappedQueryRef,
} from "../cache/QueryReference.js";
import type { QueryReference } from "../cache/QueryReference.js";
import type { OperationVariables } from "../../core/types.js";
import type { RefetchFunction, FetchMoreFunction } from "./useSuspenseQuery.js";
import type {
  FetchMoreQueryOptions,
  WatchQueryOptions,
} from "../../core/watchQueryOptions.js";

type UpdateOptionsFunction<TData, TVariables extends OperationVariables> = (
  options: WatchQueryOptions<TVariables, TData>
) => void;

export interface UsePreloadedQueryHandlersResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  refetch: RefetchFunction<TData, TVariables>;
  fetchMore: FetchMoreFunction<TData, TVariables>;
  updateOptions: UpdateOptionsFunction<TData, TVariables>;
}

export function usePreloadedQueryHandlers<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  queryRef: QueryReference<TData>
): UsePreloadedQueryHandlersResult<TData, TVariables> {
  const [, forceUpdate] = React.useState(0);

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (variables) => {
      const [internalQueryRef] = unwrapQueryRef(queryRef);
      const promise = internalQueryRef.refetch(variables);

      updateWrappedQueryRef(queryRef, internalQueryRef.promise);
      forceUpdate((c) => c + 1);

      return promise;
    },
    [queryRef]
  );

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      const [internalQueryRef] = unwrapQueryRef(queryRef);
      const promise = internalQueryRef.fetchMore(
        options as FetchMoreQueryOptions<any, any>
      );

      updateWrappedQueryRef(queryRef, internalQueryRef.promise);
      forceUpdate((c) => c + 1);

      return promise;
    },
    [queryRef]
  );

  const updateOptions: UpdateOptionsFunction<TData, TVariables> =
    React.useCallback(
      (options) => {
        const [internalQueryRef] = unwrapQueryRef(queryRef);

        if (internalQueryRef.didChangeOptions(options)) {
          const promise = internalQueryRef.applyOptions(options);
          updateWrappedQueryRef(queryRef, promise);
          forceUpdate((c) => c + 1);
        }
      },
      [queryRef]
    );

  return { refetch, fetchMore, updateOptions };
}
