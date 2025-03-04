import * as React from "rehackt";
import {
  assertWrappedQueryRef,
  getWrappedPromise,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "@apollo/client/react/internal";
import type { QueryRef } from "@apollo/client/react/internal";
import type { OperationVariables } from "../../core/types.js";
import type { SubscribeToMoreFunction } from "../../core/watchQueryOptions.js";
import type { RefetchFunction, FetchMoreFunction } from "./useSuspenseQuery.js";
import type { FetchMoreQueryOptions } from "../../core/watchQueryOptions.js";
import { useApolloClient } from "./useApolloClient.js";
import { wrapHook } from "./internal/index.js";
import type { ApolloClient } from "../../core/ApolloClient.js";
import type { ObservableQuery } from "../../core/ObservableQuery.js";

export interface UseQueryRefHandlersResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!ObservableQuery#refetch:member(1)} */
  refetch: RefetchFunction<TData, TVariables>;
  /** {@inheritDoc @apollo/client!ObservableQuery#fetchMore:member(1)} */
  fetchMore: FetchMoreFunction<TData, TVariables>;
  /** {@inheritDoc @apollo/client!ObservableQuery#subscribeToMore:member(1)} */
  subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
}

/**
 * A React hook that returns a `refetch` and `fetchMore` function for a given
 * `queryRef`.
 *
 * This is useful to get access to handlers for a `queryRef` that was created by
 * `createQueryPreloader` or when the handlers for a `queryRef` produced in
 * a different component are inaccessible.
 *
 * @example
 * ```tsx
 * const MyComponent({ queryRef }) {
 *   const { refetch, fetchMore } = useQueryRefHandlers(queryRef);
 *
 *   // ...
 * }
 * ```
 * @since 3.9.0
 * @param queryRef - A `QueryRef` returned from `useBackgroundQuery`, `useLoadableQuery`, or `createQueryPreloader`.
 */
export function useQueryRefHandlers<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  queryRef: QueryRef<TData, TVariables>
): UseQueryRefHandlersResult<TData, TVariables> {
  const unwrapped = unwrapQueryRef(queryRef);
  const clientOrObsQuery = useApolloClient(
    unwrapped ?
      // passing an `ObservableQuery` is not supported by the types, but it will
      // return any truthy value that is passed in as an override so we cast the result
      (unwrapped["observable"] as any)
    : undefined
  ) as ApolloClient<any> | ObservableQuery<TData>;

  return wrapHook(
    "useQueryRefHandlers",
    // eslint-disable-next-line react-compiler/react-compiler
    useQueryRefHandlers_,
    clientOrObsQuery
  )(queryRef);
}

function useQueryRefHandlers_<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  queryRef: QueryRef<TData, TVariables>
): UseQueryRefHandlersResult<TData, TVariables> {
  assertWrappedQueryRef(queryRef);
  const [previousQueryRef, setPreviousQueryRef] = React.useState(queryRef);
  const [wrappedQueryRef, setWrappedQueryRef] = React.useState(queryRef);
  const internalQueryRef = unwrapQueryRef(queryRef);

  // To ensure we can support React transitions, this hook needs to manage the
  // queryRef state and apply React's state value immediately to the existing
  // queryRef since this hook doesn't return the queryRef directly
  if (previousQueryRef !== queryRef) {
    setPreviousQueryRef(queryRef);
    setWrappedQueryRef(queryRef);
  } else {
    updateWrappedQueryRef(queryRef, getWrappedPromise(wrappedQueryRef));
  }

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

  return {
    refetch,
    fetchMore,
    // TODO: The internalQueryRef doesn't have TVariables' type information so we have to cast it here
    subscribeToMore: internalQueryRef.observable
      .subscribeToMore as SubscribeToMoreFunction<TData, TVariables>,
  };
}
