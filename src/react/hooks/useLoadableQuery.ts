import * as React from "rehackt";
import type {
  DocumentNode,
  FetchMoreQueryOptions,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
} from "../../core/index.js";
import { useApolloClient } from "./useApolloClient.js";
import {
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "../cache/QueryReference.js";
import type { QueryReference } from "../cache/QueryReference.js";
import type { LoadableQueryHookOptions } from "../types/types.js";
import { __use, useRenderGuard } from "./internal/index.js";
import { getSuspenseCache } from "../cache/index.js";
import { useWatchQueryOptions } from "./useSuspenseQuery.js";
import type { FetchMoreFunction, RefetchFunction } from "./useSuspenseQuery.js";
import { canonicalStringify } from "../../cache/index.js";
import type {
  DeepPartial,
  OnlyRequiredProperties,
} from "../../utilities/index.js";
import type { CacheKey } from "../cache/types.js";
import { invariant } from "../../utilities/globals/index.js";

export type LoadQueryFunction<TVariables extends OperationVariables> = (
  // Use variadic args to handle cases where TVariables is type `never`, in
  // which case we don't want to allow a variables argument. In other
  // words, we don't want to allow variables to be passed as an argument to this
  // function if the query does not expect variables in the document.
  ...args: [TVariables] extends [never] ? []
  : {} extends OnlyRequiredProperties<TVariables> ? [variables?: TVariables]
  : [variables: TVariables]
) => void;

type ResetFunction = () => void;

export type UseLoadableQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = [
  LoadQueryFunction<TVariables>,
  QueryReference<TData> | null,
  {
    fetchMore: FetchMoreFunction<TData, TVariables>;
    refetch: RefetchFunction<TData, TVariables>;
    reset: ResetFunction;
  },
];

export function useLoadableQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends LoadableQueryHookOptions,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: LoadableQueryHookOptions & TOptions
): UseLoadableQueryResult<
  TOptions["errorPolicy"] extends "ignore" | "all" ?
    TOptions["returnPartialData"] extends true ?
      DeepPartial<TData> | undefined
    : TData | undefined
  : TOptions["returnPartialData"] extends true ? DeepPartial<TData>
  : TData,
  TVariables
>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: LoadableQueryHookOptions & {
    returnPartialData: true;
    errorPolicy: "ignore" | "all";
  }
): UseLoadableQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: LoadableQueryHookOptions & {
    errorPolicy: "ignore" | "all";
  }
): UseLoadableQueryResult<TData | undefined, TVariables>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: LoadableQueryHookOptions & {
    returnPartialData: true;
  }
): UseLoadableQueryResult<DeepPartial<TData>, TVariables>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: LoadableQueryHookOptions
): UseLoadableQueryResult<TData, TVariables>;

export function useLoadableQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: LoadableQueryHookOptions = Object.create(null)
): UseLoadableQueryResult<TData, TVariables> {
  const client = useApolloClient(options.client);
  const suspenseCache = getSuspenseCache(client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { queryKey = [] } = options;

  const [queryRef, setQueryRef] = React.useState<QueryReference<TData> | null>(
    null
  );

  const internalQueryRef = queryRef && unwrapQueryRef(queryRef)[0];

  if (queryRef && internalQueryRef?.didChangeOptions(watchQueryOptions)) {
    const promise = internalQueryRef.applyOptions(watchQueryOptions);
    updateWrappedQueryRef(queryRef, promise);
  }

  const calledDuringRender = useRenderGuard();

  React.useEffect(() => internalQueryRef?.retain(), [internalQueryRef]);

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      if (!internalQueryRef) {
        throw new Error(
          "The query has not been loaded. Please load the query."
        );
      }

      const promise = internalQueryRef.fetchMore(
        options as FetchMoreQueryOptions<TVariables, TData>
      );

      setQueryRef(wrapQueryRef(internalQueryRef));

      return promise;
    },
    [internalQueryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (options) => {
      if (!internalQueryRef) {
        throw new Error(
          "The query has not been loaded. Please load the query."
        );
      }

      const promise = internalQueryRef.refetch(options);

      setQueryRef(wrapQueryRef(internalQueryRef));

      return promise;
    },
    [internalQueryRef]
  );

  const loadQuery: LoadQueryFunction<TVariables> = React.useCallback(
    (...args) => {
      invariant(
        !calledDuringRender(),
        "useLoadableQuery: 'loadQuery' should not be called during render. To start a query during render, use the 'useBackgroundQuery' hook."
      );

      const [variables] = args;

      const cacheKey: CacheKey = [
        query,
        canonicalStringify(variables),
        ...([] as any[]).concat(queryKey),
      ];

      const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
        client.watchQuery({
          ...watchQueryOptions,
          variables,
        } as WatchQueryOptions<any, any>)
      );

      setQueryRef(wrapQueryRef(queryRef));
    },
    [query, queryKey, suspenseCache, watchQueryOptions, calledDuringRender]
  );

  const reset: ResetFunction = React.useCallback(() => {
    setQueryRef(null);
  }, [queryRef]);

  return [loadQuery, queryRef, { fetchMore, refetch, reset }];
}
