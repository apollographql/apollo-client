import * as React from "rehackt";
import type {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from "../../core/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { wrapQueryRef } from "../cache/QueryReference.js";
import type {
  QueryReference,
  InternalQueryReference,
} from "../cache/QueryReference.js";
import type { InteractiveQueryHookOptions } from "../types/types.js";
import { __use } from "./internal/index.js";
import { getSuspenseCache } from "../cache/index.js";
import { useWatchQueryOptions } from "./useSuspenseQuery.js";
import type { FetchMoreFunction, RefetchFunction } from "./useSuspenseQuery.js";
import { canonicalStringify } from "../../cache/index.js";
import type { DeepPartial } from "../../utilities/index.js";
import type { CacheKey } from "../cache/types.js";

type OnlyRequiredProperties<T> = {
  [K in keyof T as {} extends Pick<T, K> ? never : K]: T[K];
};

type LoadQuery<TVariables extends OperationVariables> = (
  // Use variadic args to handle cases where TVariables is type `never`, in
  // which case we don't want to allow a variables argument. In other
  // words, we don't want to allow variables to be passed as an argument to this
  // function if the query does not expect variables in the document.
  ...args: [TVariables] extends [never]
    ? []
    : {} extends OnlyRequiredProperties<TVariables>
    ? [variables?: TVariables]
    : [variables: TVariables]
) => void;

export type UseInteractiveQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = [
  QueryReference<TData> | null,
  LoadQuery<TVariables>,
  {
    fetchMore: FetchMoreFunction<TData, TVariables>;
    refetch: RefetchFunction<TData, TVariables>;
  },
];

export function useInteractiveQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends InteractiveQueryHookOptions,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: InteractiveQueryHookOptions & TOptions
): UseInteractiveQueryResult<
  TOptions["errorPolicy"] extends "ignore" | "all"
    ? TOptions["returnPartialData"] extends true
      ? DeepPartial<TData> | undefined
      : TData | undefined
    : TOptions["returnPartialData"] extends true
    ? DeepPartial<TData>
    : TData,
  TVariables
>;

export function useInteractiveQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: InteractiveQueryHookOptions & {
    returnPartialData: true;
    errorPolicy: "ignore" | "all";
  }
): UseInteractiveQueryResult<DeepPartial<TData> | undefined, TVariables>;

export function useInteractiveQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: InteractiveQueryHookOptions & {
    errorPolicy: "ignore" | "all";
  }
): UseInteractiveQueryResult<TData | undefined, TVariables>;

export function useInteractiveQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: InteractiveQueryHookOptions & {
    returnPartialData: true;
  }
): UseInteractiveQueryResult<DeepPartial<TData>, TVariables>;

export function useInteractiveQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: InteractiveQueryHookOptions
): UseInteractiveQueryResult<TData, TVariables>;

export function useInteractiveQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: InteractiveQueryHookOptions = Object.create(null)
): UseInteractiveQueryResult<TData> {
  const client = useApolloClient(options.client);
  const suspenseCache = getSuspenseCache(client);
  const watchQueryOptions = useWatchQueryOptions({ client, query, options });
  const { queryKey = [] } = options;

  const [queryRef, setQueryRef] =
    React.useState<InternalQueryReference<TData> | null>(null);

  const [promiseCache, setPromiseCache] = React.useState(() =>
    queryRef ? new Map([[queryRef.key, queryRef.promise]]) : new Map()
  );

  if (queryRef?.didChangeOptions(watchQueryOptions)) {
    const promise = queryRef.applyOptions(watchQueryOptions);
    promiseCache.set(queryRef.key, promise);
  }

  if (queryRef) {
    queryRef.promiseCache = promiseCache;
  }

  React.useEffect(() => queryRef?.retain(), [queryRef]);

  const fetchMore: FetchMoreFunction<TData, TVariables> = React.useCallback(
    (options) => {
      if (!queryRef) {
        throw new Error(
          "The query has not been loaded. Please load the query."
        );
      }

      const promise = queryRef.fetchMore(options);

      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  const refetch: RefetchFunction<TData, TVariables> = React.useCallback(
    (options) => {
      if (!queryRef) {
        throw new Error(
          "The query has not been loaded. Please load the query."
        );
      }

      const promise = queryRef.refetch(options);

      setPromiseCache((promiseCache) =>
        new Map(promiseCache).set(queryRef.key, queryRef.promise)
      );

      return promise;
    },
    [queryRef]
  );

  const loadQuery: LoadQuery<TVariables> = React.useCallback(
    (...args) => {
      const [variables] = args;

      const cacheKey: CacheKey = [
        query,
        canonicalStringify(variables),
        ...([] as any[]).concat(queryKey),
      ];

      const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
        client.watchQuery({ ...watchQueryOptions, variables })
      );

      promiseCache.set(queryRef.key, queryRef.promise);
      setQueryRef(queryRef);
    },
    [query, queryKey, suspenseCache, watchQueryOptions, promiseCache]
  );

  return React.useMemo(() => {
    return [
      queryRef && wrapQueryRef(queryRef),
      loadQuery,
      { fetchMore, refetch },
    ];
  }, [queryRef, loadQuery, fetchMore, refetch]);
}
