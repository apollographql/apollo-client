import * as React from "rehackt";
import type {
  ApolloClient,
  DefaultContext,
  DocumentNode,
  ErrorPolicy,
  FetchMoreQueryOptions,
  OperationVariables,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "../../core/index.js";
import { useApolloClient } from "./useApolloClient.js";
import {
  getSuspenseCache,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "../internal/index.js";
import type { CacheKey, QueryReference } from "../internal/index.js";
import type { NoInfer } from "../types/types.js";
import { __use } from "./internal/index.js";
import { useWatchQueryOptions } from "./useSuspenseQuery.js";
import type { FetchMoreFunction, RefetchFunction } from "./useSuspenseQuery.js";
import { canonicalStringify } from "../../cache/index.js";
import type { DeepPartial } from "../../utilities/index.js";
import type { SkipToken } from "./constants.js";

export type BackgroundQueryHookFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export interface BackgroundQueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!QueryOptions#canonizeResults:member} */
  canonizeResults?: boolean;
  /** {@inheritDoc @apollo/client!BaseQueryOptions#client:member} */
  client?: ApolloClient<any>;
  /** {@inheritDoc @apollo/client!QueryOptions#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!QueryOptions#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
  /** {@inheritDoc @apollo/client!QueryOptions#returnPartialData:member} */
  returnPartialData?: boolean;
  /** {@inheritDoc @apollo/client!WatchQueryOptions#refetchWritePolicy:member} */
  refetchWritePolicy?: RefetchWritePolicy;
  /** {@inheritDoc @apollo/client!QueryOptions#canonizeResults:member} */
  fetchPolicy?: BackgroundQueryHookFetchPolicy;
  queryKey?: string | number | any[];

  /**
   * If `true`, the query is not executed. The default value is `false`.
   *
   * @deprecated We recommend using `skipToken` in place of the `skip` option as
   * it is more type-safe.
   *
   * @example Recommended usage of `skipToken`:
   * ```ts
   * import { skipToken, useBackgroundQuery } from '@apollo/client';
   *
   * const [queryRef] = useBackgroundQuery(query, id ? { variables: { id } } : skipToken);
   * ```
   */
  skip?: boolean;
}

export type UseBackgroundQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = {
  fetchMore: FetchMoreFunction<TData, TVariables>;
  refetch: RefetchFunction<TData, TVariables>;
};

type BackgroundQueryHookOptionsNoInfer<
  TData,
  TVariables extends OperationVariables,
> = BackgroundQueryHookOptions<NoInfer<TData>, NoInfer<TVariables>>;

export function useBackgroundQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends Omit<BackgroundQueryHookOptions<TData>, "variables">,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & TOptions
): [
  (
    | QueryReference<
        TOptions["errorPolicy"] extends "ignore" | "all" ?
          TOptions["returnPartialData"] extends true ?
            DeepPartial<TData> | undefined
          : TData | undefined
        : TOptions["returnPartialData"] extends true ? DeepPartial<TData>
        : TData,
        TVariables
      >
    | (TOptions["skip"] extends boolean ? undefined : never)
  ),
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    returnPartialData: true;
    errorPolicy: "ignore" | "all";
  }
): [
  QueryReference<DeepPartial<TData> | undefined, TVariables>,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    errorPolicy: "ignore" | "all";
  }
): [
  QueryReference<TData | undefined, TVariables>,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    skip: boolean;
    returnPartialData: true;
  }
): [
  QueryReference<DeepPartial<TData>, TVariables> | undefined,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    returnPartialData: true;
  }
): [
  QueryReference<DeepPartial<TData>, TVariables>,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
    skip: boolean;
  }
): [
  QueryReference<TData, TVariables> | undefined,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: BackgroundQueryHookOptionsNoInfer<TData, TVariables>
): [
  QueryReference<TData, TVariables>,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken
): [undefined, UseBackgroundQueryResult<TData, TVariables>];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (BackgroundQueryHookOptionsNoInfer<TData, TVariables> & {
        returnPartialData: true;
      })
): [
  QueryReference<DeepPartial<TData>, TVariables> | undefined,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SkipToken | BackgroundQueryHookOptionsNoInfer<TData, TVariables>
): [
  QueryReference<TData, TVariables> | undefined,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | (SkipToken &
        Partial<BackgroundQueryHookOptionsNoInfer<TData, TVariables>>)
    | BackgroundQueryHookOptionsNoInfer<TData, TVariables> = Object.create(null)
): [
  QueryReference<TData, TVariables> | undefined,
  UseBackgroundQueryResult<TData, TVariables>,
] {
  const client = useApolloClient(options.client);
  const suspenseCache = getSuspenseCache(client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { fetchPolicy, variables } = watchQueryOptions;
  const { queryKey = [] } = options;

  // This ref tracks the first time query execution is enabled to determine
  // whether to return a query ref or `undefined`. When initialized
  // in a skipped state (either via `skip: true` or `skipToken`) we return
  // `undefined` for the `queryRef` until the query has been enabled. Once
  // enabled, a query ref is always returned regardless of whether the query is
  // skipped again later.
  const didFetchResult = React.useRef(fetchPolicy !== "standby");
  didFetchResult.current ||= fetchPolicy !== "standby";

  const cacheKey: CacheKey = [
    query,
    canonicalStringify(variables),
    ...([] as any[]).concat(queryKey),
  ];

  const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
    client.watchQuery(watchQueryOptions as WatchQueryOptions<any, any>)
  );

  const [wrappedQueryRef, setWrappedQueryRef] = React.useState(
    wrapQueryRef(queryRef)
  );
  if (unwrapQueryRef(wrappedQueryRef) !== queryRef) {
    setWrappedQueryRef(wrapQueryRef(queryRef));
  }
  if (queryRef.didChangeOptions(watchQueryOptions)) {
    const promise = queryRef.applyOptions(watchQueryOptions);
    updateWrappedQueryRef(wrappedQueryRef, promise);
  }

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      const promise = queryRef.fetchMore(options as FetchMoreQueryOptions<any>);

      setWrappedQueryRef(wrapQueryRef(queryRef));

      return promise;
    },
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (variables) => {
      const promise = queryRef.refetch(variables);

      setWrappedQueryRef(wrapQueryRef(queryRef));

      return promise;
    },
    [queryRef]
  );

  return [
    didFetchResult.current ? wrappedQueryRef : void 0,
    { fetchMore, refetch },
  ];
}
