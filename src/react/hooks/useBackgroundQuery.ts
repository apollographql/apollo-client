import * as React from "react";

import type {
  ApolloClient,
  DataState,
  DefaultContext,
  DocumentNode,
  ErrorPolicy,
  OperationVariables,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from "@apollo/client";
import type { SubscribeToMoreFunction } from "@apollo/client";
import { canonicalStringify } from "@apollo/client/cache";
import type {
  CacheKey,
  FetchMoreFunction,
  QueryRef,
  RefetchFunction,
} from "@apollo/client/react/internal";
import {
  getSuspenseCache,
  unwrapQueryRef,
  updateWrappedQueryRef,
  wrapQueryRef,
} from "@apollo/client/react/internal";
import type {
  NoInfer,
  VariablesOption,
} from "@apollo/client/utilities/internal";

import type { SkipToken } from "./constants.js";
import { wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useWatchQueryOptions } from "./useSuspenseQuery.js";

export declare namespace useBackgroundQuery {
  export type FetchPolicy = Extract<
    WatchQueryFetchPolicy,
    "cache-first" | "network-only" | "no-cache" | "cache-and-network"
  >;

  export type Options<
    TVariables extends OperationVariables = OperationVariables,
  > = {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#client:member} */
    client?: ApolloClient;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
    refetchWritePolicy?: RefetchWritePolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
    context?: DefaultContext;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
    returnPartialData?: boolean;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: FetchPolicy;

    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#queryKey:member} */
    queryKey?: string | number | any[];

    /**
     * {@inheritDoc @apollo/client!QueryOptionsDocumentation#skip_deprecated:member}
     *
     * @example Recommended usage of `skipToken`:
     * ```ts
     * import { skipToken, useBackgroundQuery } from '@apollo/client';
     *
     * const [queryRef] = useBackgroundQuery(query, id ? { variables: { id } } : skipToken);
     * ```
     */
    skip?: boolean;
  } & VariablesOption<TVariables>;

  export type Result<
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
}

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    /** @deprecated `returnPartialData` has no effect on `no-cache` queries */
    returnPartialData: boolean;
    fetchPolicy: "no-cache";
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming">,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: false;
    errorPolicy: "ignore" | "all";
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "empty">,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: boolean;
    errorPolicy: "ignore" | "all";
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "partial" | "empty">,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    errorPolicy: "ignore" | "all";
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "empty">,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    skip: boolean;
    returnPartialData: false;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    skip: boolean;
    returnPartialData: boolean;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "partial"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: false;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming">,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    returnPartialData: boolean;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "partial">,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: useBackgroundQuery.Options<NoInfer<TVariables>> & {
    skip: boolean;
  }
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken
): [undefined, useBackgroundQuery.Result<TData, TVariables>];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (useBackgroundQuery.Options<NoInfer<TVariables>> & {
        returnPartialData: false;
      })
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | SkipToken
    | (useBackgroundQuery.Options<NoInfer<TVariables>> & {
        returnPartialData: boolean;
      })
): [
  QueryRef<TData, TVariables, "complete" | "streaming" | "partial"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [options?: useBackgroundQuery.Options<NoInfer<TVariables>>]
  : [options: useBackgroundQuery.Options<NoInfer<TVariables>>]
): [
  QueryRef<TData, TVariables, "complete" | "streaming">,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options]: {} extends TVariables ?
    [options?: SkipToken | useBackgroundQuery.Options<NoInfer<TVariables>>]
  : [options: SkipToken | useBackgroundQuery.Options<NoInfer<TVariables>>]
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SkipToken | useBackgroundQuery.Options<NoInfer<TVariables>>
): [
  QueryRef<TData, TVariables, "complete" | "streaming"> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
];

export function useBackgroundQuery<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SkipToken | useBackgroundQuery.Options<NoInfer<TVariables>>
): [
  QueryRef<TData, TVariables, DataState<TData>["dataState"]> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
] {
  "use no memo";
  return wrapHook(
    "useBackgroundQuery",
    // eslint-disable-next-line react-compiler/react-compiler
    useBackgroundQuery_,
    useApolloClient(typeof options === "object" ? options.client : undefined)
  )(query, options ?? ({} as any));
}

function useBackgroundQuery_<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TStates extends DataState<TData>["dataState"] = DataState<TData>["dataState"],
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options:
    | (SkipToken & Partial<useBackgroundQuery.Options<NoInfer<TVariables>>>)
    | useBackgroundQuery.Options<NoInfer<TVariables>>
): [
  QueryRef<TData, TVariables, TStates> | undefined,
  useBackgroundQuery.Result<TData, TVariables>,
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

  const queryRef = suspenseCache.getQueryRef<TData, TStates>(cacheKey, () =>
    client.watchQuery(
      watchQueryOptions as ApolloClient.WatchQueryOptions<any, any>
    )
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
      const promise = queryRef.fetchMore(options);

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
      // TODO: The internalQueryRef doesn't have TVariables' type information so we have to cast it here
      subscribeToMore: queryRef.observable
        .subscribeToMore as SubscribeToMoreFunction<TData, TVariables>,
    },
  ];
}
