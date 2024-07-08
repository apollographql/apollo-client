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
  getSuspenseCache,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "../internal/index.js";
import type { CacheKey, QueryRef } from "../internal/index.js";
import type { BackgroundQueryHookOptions, NoInfer } from "../types/types.js";
import { wrapHook } from "./internal/index.js";
import { useWatchQueryOptions } from "./useSuspenseQuery.js";
import type {
  FetchMoreFunction,
  RefetchFunction,
  SubscribeToMoreFunction,
} from "./useSuspenseQuery.js";
import { canonicalStringify } from "../../cache/index.js";
import type { DeepPartial } from "../../utilities/index.js";
import type { SkipToken } from "./constants.js";

export type UseBackgroundQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = {
  /** {@inheritDoc @apollo/client!ObservableQuery#subscribeToMore:member(1)} */
  subscribeToMore: SubscribeToMoreFunction<TData, TVariables>;
  /** {@inheritDoc @apollo/client!ObservableQuery#fetchMore:member(1)} */
  fetchMore: FetchMoreFunction<TData, TVariables>;
  /** {@inheritDoc @apollo/client!ObservableQuery#refetch:member(1)} */
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
    | QueryRef<
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
  QueryRef<DeepPartial<TData> | undefined, TVariables>,
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
  QueryRef<TData | undefined, TVariables>,
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
  QueryRef<DeepPartial<TData>, TVariables> | undefined,
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
  QueryRef<DeepPartial<TData>, TVariables>,
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
  QueryRef<TData, TVariables> | undefined,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: BackgroundQueryHookOptionsNoInfer<TData, TVariables>
): [QueryRef<TData, TVariables>, UseBackgroundQueryResult<TData, TVariables>];

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
  QueryRef<DeepPartial<TData>, TVariables> | undefined,
  UseBackgroundQueryResult<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SkipToken | BackgroundQueryHookOptionsNoInfer<TData, TVariables>
): [
  QueryRef<TData, TVariables> | undefined,
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
  QueryRef<TData, TVariables> | undefined,
  UseBackgroundQueryResult<TData, TVariables>,
] {
  return wrapHook(
    "useBackgroundQuery",
    _useBackgroundQuery,
    useApolloClient(typeof options === "object" ? options.client : undefined)
  )(query, options);
}

function _useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | (SkipToken &
        Partial<BackgroundQueryHookOptionsNoInfer<TData, TVariables>>)
    | BackgroundQueryHookOptionsNoInfer<TData, TVariables>
): [
  QueryRef<TData, TVariables> | undefined,
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

  // This prevents issues where rerendering useBackgroundQuery after the
  // queryRef has been disposed would cause the hook to return a new queryRef
  // instance since disposal also removes it from the suspense cache. We add
  // the queryRef back in the suspense cache so that the next render will reuse
  // this queryRef rather than initializing a new instance.
  React.useEffect(() => {
    // Since the queryRef is disposed async via `setTimeout`, we have to wait a
    // tick before checking it and adding back to the suspense cache.
    const id = setTimeout(() => {
      if (queryRef.disposed) {
        suspenseCache.add(cacheKey, queryRef);
      }
    });

    return () => clearTimeout(id);
    // Omitting the deps is intentional. This avoids stale closures and the
    // conditional ensures we aren't running the logic on each render.
  });

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

  React.useEffect(() => queryRef.softRetain(), [queryRef]);

  return [
    didFetchResult.current ? wrappedQueryRef : void 0,
    {
      fetchMore,
      refetch,
      subscribeToMore: queryRef.observable.subscribeToMore,
    },
  ];
}
