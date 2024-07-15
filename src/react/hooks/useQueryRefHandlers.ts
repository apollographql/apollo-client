import * as React from "rehackt";
import {
  assertWrappedQueryRef,
  getWrappedPromise,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "../internal/index.js";
import type { QueryRef } from "../internal/index.js";
import type { OperationVariables } from "../../core/types.js";
import type {
  RefetchFunction,
  FetchMoreFunction,
  SubscribeToMoreFunction,
} from "./useSuspenseQuery.js";
import type { FetchMoreQueryOptions } from "../../core/watchQueryOptions.js";
import { useApolloClient } from "./useApolloClient.js";
import { wrapHook } from "./internal/index.js";

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

  return wrapHook(
    "useQueryRefHandlers",
    _useQueryRefHandlers,
    unwrapped ?
      unwrapped["observable"]
      // in the case of a "transported" queryRef object, we need to use the
      // client that's available to us at the current position in the React tree
      // that ApolloClient will then have the job to recreate a real queryRef from
      // the transported object
      // This is just a context read - it's fine to do this conditionally.
      // This hook wrapper also shouldn't be optimized by React Compiler.
      // eslint-disable-next-line react-compiler/react-compiler
      // eslint-disable-next-line react-hooks/rules-of-hooks
    : useApolloClient()
  )(queryRef);
}

function _useQueryRefHandlers<
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
    subscribeToMore: internalQueryRef.observable.subscribeToMore,
  };
}
